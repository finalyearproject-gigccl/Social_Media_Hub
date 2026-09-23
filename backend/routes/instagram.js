const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const {
  createSocialAccount,
  findSocialAccountByPlatform,
  updateSocialAccountToken,
} = require("../models/social");

const router = express.Router();

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const API_VERSION = process.env.INSTAGRAM_API_VERSION || "v23.0";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";
const REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? "https://yourdomain.com/auth/instagram/callback"
    : `http://localhost:3001/auth/instagram/callback`;

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

// GET /auth/instagram
router.get("/", (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res
      .status(401)
      .json({ error: "Authentication required. Please login first." });
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  // Use Facebook OAuth endpoint instead of Instagram Basic Display
  const authUrl = `https://www.facebook.com/${API_VERSION}/dialog/oauth?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement&response_type=code&state=${state}`;

  logger.info(`Redirecting to Facebook/Instagram auth URL for user: ${userId}`);
  res.redirect(authUrl);
});

// GET /auth/instagram/callback
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code not found");
  }

  let userId;
  try {
    const decodedState = JSON.parse(Buffer.from(state, "base64").toString());
    userId = decodedState.userId;
    logger.info(`Received callback for user ID: ${userId}`);
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
        .send(
          "No Facebook Pages found. Please create a Facebook Page linked to your Instagram Business account.",
        );
    }

    // Step 3: Find the page that has an Instagram business account linked
    let igAccountId = null;
    let pageAccessToken = null;
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
        pageName = page.name;
        break;
      }
    }

    if (!igAccountId) {
      return res
        .status(400)
        .send("No Instagram Business account linked to your Facebook Pages.");
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

    // Step 5: Save or update the account
    const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    let socialAccount = await findSocialAccountByPlatform(
      userId,
      "instagram",
      profile.username,
    );

    if (socialAccount) {
      socialAccount = await updateSocialAccountToken(
        socialAccount.account_id,
        pageAccessToken,
        null,
        tokenExpiry,
      );
    } else {
      socialAccount = await createSocialAccount({
        userId,
        platform: "instagram",
        accountHandle: profile.username,
        accountName: profile.name || profile.username,
        accessToken: pageAccessToken,
        tokenExpiry,
        platformData: {
          instagram_user_id: igAccountId,
          page_name: pageName,
        },
      });
    }

    logger.info("Instagram Business account connected successfully");
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>✅ Instagram Connected Successfully!</h1>
          <p>Connected as @${profile.username}</p>
          <p>You can close this window and return to the app.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error(
      "Error in Instagram callback:",
      error.response?.data || error.message,
    );
    res
      .status(500)
      .send(
        `Failed to authenticate: ${error.response?.data?.error?.message || error.message}`,
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

// GET /auth/instagram/account-info
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

// GET /auth/instagram/media
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

// GET /auth/instagram/insights
router.get("/insights", async (req, res) => {
  try {
    const account = await getInstagramAccount(req);
    const igId = account.platform_data?.instagram_user_id;

    const metrics = [
      "impressions",
      "reach",
      "profile_views",
      "website_clicks",
      "follower_count",
    ];

    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/insights`,
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
      "Error fetching insights:",
      error.response?.data || error.message,
    );
    res
      .status(500)
      .json({
        error: error.message,
        details: error.response?.data?.error?.message,
      });
  }
});

// GET /auth/instagram/analytics-summary
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

    // Get insights
    const insightsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${igId}/insights`,
      {
        params: {
          metric: "impressions,reach,profile_views",
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
    res
      .status(500)
      .json({
        error: error.message,
        details: error.response?.data?.error?.message,
      });
  }
});

module.exports = router;
