const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { renderOAuthPage } = require("../utils/oauthPage");
const {
  createSocialAccount,
  findSocialAccountByPlatform,
  findSocialAccountsByUserId,
  updateSocialAccountToken,
} = require("../models/social");
const { query } = require("../config/database");

const router = express.Router();

// Configuration
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const API_VERSION = process.env.INSTAGRAM_API_VERSION || "v22.0";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";
const REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? "https://yourdomain.com/auth/meta/callback"
    : `http://localhost:3001/auth/meta/callback`;

// Valid Instagram insights metrics (NOT impressions!)
const VALID_INSIGHTS_METRICS = [
  "reach",
  "follower_count",
  "profile_views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
];

// Helper to get userId from token (query param or header)
function getUserIdFromRequest(req) {
  const tokenFromQuery = req.query.token;
  const tokenFromHeader = req.headers.authorization?.replace("Bearer ", "");
  const token = tokenFromQuery || tokenFromHeader;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || decoded.id;
  } catch (error) {
    logger.error("Token validation failed:", error.message);
    return null;
  }
}

// GET /auth/meta - Start OAuth flow
router.get("/", (req, res) => {
  const userId = getUserIdFromRequest(req);

  if (!userId) {
    return res
      .status(401)
      .json({ error: "Authentication required. Please login first." });
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  // Facebook OAuth with Instagram and page publishing permissions
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_manage_insights",
    "instagram_content_publish",
  ].join(",");

  const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}&response_type=code&state=${state}`;

  logger.info(`Redirecting to Meta auth URL for user: ${userId}`);
  res.redirect(authUrl);
});

// GET /auth/meta/callback - Handle OAuth callback
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code not found");
  }

  let userId;
  try {
    const decodedState = JSON.parse(Buffer.from(state, "base64").toString());
    userId = decodedState.userId;
    logger.info(`Received Meta callback for user ID: ${userId}`);
  } catch (error) {
    return res.status(400).send("Invalid state parameter");
  }

  try {
    // Step 1: Exchange code for Facebook access token
    const tokenResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/oauth/access_token`,
      {
        params: {
          client_id: INSTAGRAM_APP_ID,
          client_secret: INSTAGRAM_APP_SECRET,
          redirect_uri: REDIRECT_URI,
          code,
        },
      },
    );

    const accessToken = tokenResponse.data.access_token;
    logger.info("Received Facebook access token");

    // Step 2: Get Facebook pages linked to this user
    const pagesResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/me/accounts`,
      { params: { access_token: accessToken } },
    );

    const pages = pagesResponse.data.data;
    if (!pages || pages.length === 0) {
      return res
        .status(400)
        .send("No Facebook Pages found. Please create a Facebook Page first.");
    }

    // Step 3: Find the page that has an Instagram business account linked
    let igAccountId = null;
    let pageAccessToken = null;
    let pageId = null;
    let pageName = null;

    for (const page of pages) {
      const igResponse = await axios.get(
        `https://graph.facebook.com/${API_VERSION}/${page.id}`,
        {
          params: {
            fields: "instagram_business_account",
            access_token: page.access_token,
          },
        },
      );

      if (igResponse.data.instagram_business_account) {
        igAccountId = igResponse.data.instagram_business_account.id;
        pageAccessToken = page.access_token;
        pageId = page.id;
        pageName = page.name;
        break;
      }
    }

    if (!igAccountId) {
      return res
        .status(400)
        .send("No Instagram Business account linked to your Facebook Page.");
    }

    logger.info(`Found Instagram Business Account ID: ${igAccountId}`);

    // Step 4: Get Instagram account profile
    const profileResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igAccountId}`,
      {
        params: {
          fields:
            "id,username,name,biography,followers_count,media_count,profile_picture_url",
          access_token: pageAccessToken,
        },
      },
    );

    const profile = profileResponse.data;
    logger.info(`Fetched Instagram profile: ${profile.username}`);

    const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    // Step 5: Store Facebook Page record
    let facebookAccount = await findSocialAccountByPlatform(
      userId,
      "facebook",
      pageId,
    );
    if (facebookAccount) {
      logger.info(
        `Updating existing Facebook account record for page: ${pageName}`,
      );
      facebookAccount = await updateSocialAccountToken(
        facebookAccount.account_id,
        pageAccessToken,
        null,
        tokenExpiry,
      );
    } else {
      facebookAccount = await createSocialAccount({
        userId,
        platform: "facebook",
        accountHandle: pageId,
        accountName: pageName,
        accessToken: pageAccessToken,
        tokenExpiry,
        platformData: {
          page_id: pageId,
          page_name: pageName,
        },
      });
    }

    // Step 6: Store Instagram record
    let instagramAccount = await findSocialAccountByPlatform(
      userId,
      "instagram",
      profile.username,
    );
    if (instagramAccount) {
      logger.info(
        `Updating existing Instagram account record for profile: @${profile.username}`,
      );
      instagramAccount = await updateSocialAccountToken(
        instagramAccount.account_id,
        pageAccessToken,
        null,
        tokenExpiry,
      );
    } else {
      instagramAccount = await createSocialAccount({
        userId,
        platform: "instagram",
        accountHandle: profile.username,
        accountName: profile.name || profile.username,
        accessToken: pageAccessToken,
        tokenExpiry,
        platformData: {
          instagram_user_id: igAccountId,
          page_id: pageId,
          page_name: pageName,
        },
      });
    }

    logger.info("Meta (Facebook + Instagram) connected successfully");
    res.type("html").send(
      renderOAuthPage({
        platform: "Meta",
        success: true,
        title: "Meta is connected",
        message: "Your Facebook Page and Instagram account are ready to use.",
        details: [
          { label: "Facebook Page", value: pageName },
          { label: "Instagram", value: `@${profile.username}` },
        ],
      }),
    );
  } catch (error) {
    logger.error(
      "Error in Meta callback:",
      error.response?.data || error.message,
    );
    res
      .status(500)
      .type("html")
      .send(
        renderOAuthPage({
          platform: "Meta",
          success: false,
          title: "Meta connection failed",
          message:
            error.response?.data?.error?.message ||
            "We could not complete the connection. Please close this window and try again.",
        }),
      );
  }
});

// Helper to get Instagram account
async function getInstagramAccount(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) throw new Error("Authentication required");

  const account = await findSocialAccountByPlatform(userId, "instagram");
  if (!account) throw new Error("Instagram account not connected");

  if (account.token_expiry && new Date() > new Date(account.token_expiry)) {
    throw new Error("Instagram token expired. Please reconnect your account.");
  }

  return account;
}

// Helper to get Facebook account
async function getFacebookAccount(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) throw new Error("Authentication required");

  const accounts = await findSocialAccountsByUserId(userId);
  const facebookAccount = accounts.find((acc) => acc.platform === "facebook");

  if (!facebookAccount) throw new Error("Facebook account not connected");

  if (
    facebookAccount.token_expiry &&
    new Date() > new Date(facebookAccount.token_expiry)
  ) {
    throw new Error("Facebook token expired. Please reconnect your account.");
  }

  return facebookAccount;
}

// GET /auth/meta/account-info - Get Instagram profile
router.get("/account-info", async (req, res) => {
  try {
    const account = await getInstagramAccount(req);
    const igId = account.platform_data?.instagram_user_id;

    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}`,
      {
        params: {
          fields:
            "id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count",
          access_token: account.access_token,
        },
      },
    );

    res.json(response.data);
  } catch (error) {
    logger.error(
      "Error fetching account info:",
      error.response?.data || error.message,
    );
    res.status(500).json({ error: error.message });
  }
});

// GET /auth/meta/media - Get Instagram media
router.get("/media", async (req, res) => {
  try {
    const account = await getInstagramAccount(req);
    const igId = account.platform_data?.instagram_user_id;
    const limit = req.query.limit || 20;

    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/media`,
      {
        params: {
          fields:
            "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
          limit,
          access_token: account.access_token,
        },
      },
    );

    res.json({ data: response.data.data, paging: response.data.paging });
  } catch (error) {
    logger.error(
      "Error fetching media:",
      error.response?.data || error.message,
    );
    res.status(500).json({ error: error.message });
  }
});

// GET /auth/meta/insights - Get Instagram insights (FIXED metrics!)
router.get("/insights", async (req, res) => {
  try {
    const account = await getInstagramAccount(req);
    const igId = account.platform_data?.instagram_user_id;

    // Use VALID metrics only (NOT impressions!)
    const metrics = VALID_INSIGHTS_METRICS.join(",");

    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/insights`,
      {
        params: {
          metric: metrics,
          period: "day",
          access_token: account.access_token,
        },
      },
    );

    const insights = {};
    response.data.data.forEach((item) => {
      insights[item.name] = item.values[0]?.value || 0;
    });

    res.json(insights);
  } catch (error) {
    logger.error(
      "Error fetching insights:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      error: error.message,
      details: error.response?.data?.error?.message,
    });
  }
});

// GET /auth/meta/analytics-summary - Get comprehensive analytics
router.get("/analytics-summary", async (req, res) => {
  try {
    const account = await getInstagramAccount(req);
    const igId = account.platform_data?.instagram_user_id;

    // Get profile
    const profileResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}`,
      {
        params: {
          fields:
            "username,followers_count,follows_count,media_count,biography,name,profile_picture_url",
          access_token: account.access_token,
        },
      },
    );

    // Get recent media
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/media`,
      {
        params: {
          fields: "id,caption,media_type,timestamp,like_count,comments_count",
          limit: 10,
          access_token: account.access_token,
        },
      },
    );

    // Get insights (using VALID metrics only!)
    const insightsMetrics = ["reach", "follower_count"];
    const insightsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/insights`,
      {
        params: {
          metric: insightsMetrics.join(","),
          period: "day",
          access_token: account.access_token,
        },
      },
    );

    const insights = {};
    insightsResponse.data.data.forEach((item) => {
      insights[item.name] = item.values[0]?.value || 0;
    });

    const totalEngagement = mediaResponse.data.data.reduce(
      (sum, post) => sum + (post.like_count || 0) + (post.comments_count || 0),
      0,
    );

    const averageEngagement =
      mediaResponse.data.data.length > 0
        ? (totalEngagement / mediaResponse.data.data.length).toFixed(2)
        : 0;

    res.json({
      account: profileResponse.data,
      insights,
      engagement: {
        total: totalEngagement,
        average: parseFloat(averageEngagement),
        posts: mediaResponse.data.data.length,
      },
      recentMedia: mediaResponse.data.data,
    });
  } catch (error) {
    logger.error(
      "Error fetching analytics summary:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      error: error.message,
      details: error.response?.data?.error?.message,
    });
  }
});

// GET /auth/meta/facebook/insights - Get Facebook Page insights
router.get("/facebook/insights", async (req, res) => {
  try {
    const account = await getFacebookAccount(req);
    const pageId = account.platform_data?.page_id;

    const metrics = ["page_impressions", "page_reach", "page_engaged_users"];

    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${pageId}/insights`,
      {
        params: {
          metric: metrics.join(","),
          period: "day",
          access_token: account.access_token,
        },
      },
    );

    const insights = {};
    response.data.data.forEach((item) => {
      insights[item.name] = item.values[0]?.value || 0;
    });

    res.json(insights);
  } catch (error) {
    logger.error(
      "Error fetching Facebook insights:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      error: error.message,
      details: error.response?.data?.error?.message,
    });
  }
});

router.delete("/disconnect", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await query(
      `UPDATE public.social_account 
       SET is_connected = false, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND platform IN ('instagram', 'facebook')`,
      [userId],
    );

    logger.info(`Disconnected Meta accounts for user ID: ${userId}`);
    res.json({ message: "Accounts disconnected successfully" });
  } catch (error) {
    logger.error("Error disconnecting Meta accounts:", error.message);
    res.status(500).json({ error: "Failed to disconnect accounts" });
  }
});

// GET /auth/meta/account-summary - Combined Instagram + Facebook analytics for Dashboard
// Uses separate platform functions for easy extensibility to YouTube, etc.
router.get("/account-summary", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = {
      platforms: [],
      combined: {
        totalFollowers: 0,
        totalReach: 0,
        totalEngagement: 0,
        totalPosts: 0,
      },
    };

    // Get Instagram analytics (if connected)
    const igData = await getInstagramAnalytics(userId);
    if (igData) {
      result.platforms.push(igData);
      if (igData.followers) result.combined.totalFollowers += igData.followers;
      if (igData.reach) result.combined.totalReach += igData.reach;
      if (igData.engagement)
        result.combined.totalEngagement += igData.engagement;
      if (igData.posts) result.combined.totalPosts += igData.posts;
    } else {
      result.platforms.push({ platform: "instagram", connected: false });
    }

    // Get Facebook analytics (if connected)
    const fbData = await getFacebookAnalytics(userId);
    if (fbData) {
      result.platforms.push(fbData);
      if (fbData.followers) result.combined.totalFollowers += fbData.followers;
      if (fbData.reach) result.combined.totalReach += fbData.reach;
      if (fbData.engagement)
        result.combined.totalEngagement += fbData.engagement;
    } else {
      result.platforms.push({ platform: "facebook", connected: false });
    }

    res.json(result);
  } catch (error) {
    logger.error(
      "Error fetching account summary:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      error: error.message,
      details: error.response?.data?.error?.message,
    });
  }
});

// ============================================
// Platform-specific analytics functions
// ============================================

// Get Instagram analytics
async function getInstagramAnalytics(userId) {
  const account = await findSocialAccountByPlatform(userId, "instagram");
  logger.info(
    `Fetching Instagram analytics for user ID: ${userId}, found account: ${
      account ? account.account_name : "none"
    }`,
  );
  if (!account || !account.is_connected) return null;

  const igId = account.platform_data?.instagram_user_id;
  if (!igId) return null;

  try {
    // Get profile (followers_count is a profile field, NOT an insight)
    const profileResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}`,
      {
        params: {
          fields:
            "username,followers_count,follows_count,media_count,name,profile_picture_url",
          access_token: account.access_token,
        },
      },
    );

    // Get recent media
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/media`,
      {
        params: {
          fields:
            "id,caption,media_type,timestamp,like_count,comments_count,media_url",
          limit: 5,
          access_token: account.access_token,
        },
      },
    );

    // Get valid insights (reach is valid, follower_count is NOT)
    const insightsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/insights`,
      {
        params: {
          metric: "reach",
          period: "day",
          access_token: account.access_token,
        },
      },
    );

    const insights = {};
    insightsResponse.data.data.forEach((item) => {
      insights[item.name] = item.values[0]?.value || 0;
    });

    const engagement = mediaResponse.data.data.reduce(
      (sum, post) => sum + (post.like_count || 0) + (post.comments_count || 0),
      0,
    );

    return {
      platform: "instagram",
      connected: true,
      profile: profileResponse.data,
      insights,
      recentPosts: mediaResponse.data.data,
      // Flattened metrics for combining
      followers: profileResponse.data.followers_count || 0,
      reach: insights.reach || 0,
      engagement,
      posts: profileResponse.data.media_count || 0,
    };
  } catch (error) {
    logger.error("Error fetching Instagram analytics:" + error.message);
    return null;
  }
}

// Get Facebook analytics
async function getFacebookAnalytics(userId) {
  const accounts = await findSocialAccountsByUserId(userId);
  const account = accounts.find(
    (acc) => acc.platform === "facebook" && acc.is_connected,
  );
  logger.info(
    `Fetching Facebook analytics for user ID: ${userId}, found account: ${
      account ? account.account_name : "none"
    }`,
  );
  if (!account) return null;

  const pageId = account.platform_data?.page_id;
  if (!pageId) return null;

  try {
    // Get page info
    const pageResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${pageId}`,
      {
        params: {
          fields: "name,fan_count,followers_count,picture",
          access_token: account.access_token,
        },
      },
    );

    // Get recent posts and calculate engagement from them
    const postsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${pageId}/posts`,
      {
        params: {
          fields:
            "id,message,created_time,likes.summary(true),comments.summary(true),full_picture,attachments{media_type,type,media,description}",
          limit: 10,
          access_token: account.access_token,
        },
      },
    );

    const recentPosts = postsResponse.data.data.map((post) => {
      const attachment = post.attachments?.data?.[0];

      // Truncate long messages to prevent UI overflow
      const truncatedMessage =
        post.message?.length > 150
          ? post.message.substring(0, 150) + "..."
          : post.message;

      return {
        id: post.id,
        message: truncatedMessage,
        caption: post.message || null,
        timestamp: post.created_time,
        likes: post.likes?.summary?.total_count || 0,
        comments: post.comments?.summary?.total_count || 0,
        image: post.full_picture || attachment?.media?.image?.src || null,
        media_type: attachment?.type || "text", // "photo", "video", "share", "text"
      };
    });

    const engagement = recentPosts.reduce((sum, post) => {
      const likes = post.likes?.summary?.total_count || 0;
      const comments = post.comments?.summary?.total_count || 0;
      return sum + likes + comments;
    }, 0);

    // Try insights separately and gracefully handle if it fails
    let reach = 0;
    let insights = {};
    try {
      const insightsResponse = await axios.get(
        `https://graph.facebook.com/${API_VERSION}/${pageId}/insights`,
        {
          params: {
            metric: "page_impressions_unique",
            period: "day",
            access_token: account.access_token,
          },
        },
      );
      reach = insightsResponse.data.data?.[0]?.values?.[0]?.value || 0;
      insights = { reach };
    } catch (insightErr) {
      logger.warn("Facebook insights unavailable: " + insightErr.message);
    }

    return {
      platform: "facebook",
      connected: true,
      profile: pageResponse.data,
      insights,
      recentPosts,
      // Flattened metrics
      followers:
        pageResponse.data.followers_count || pageResponse.data.fan_count || 0,
      reach,
      engagement,
      posts: recentPosts.length,
    };
  } catch (error) {
    logger.error("Error fetching Facebook analytics:" + JSON.stringify(error));
    return null;
  }
}

module.exports = router;
