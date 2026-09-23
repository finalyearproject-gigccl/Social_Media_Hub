const express = require("express");
const axios = require("axios");
const logger = require("../utils/logger");
const {
  findSocialAccountsByUserId,
  findSocialAccountByPlatform,
  createAnalytics,
  getUserLatestAnalytics,
  getAnalyticsHistory,
  getUserAnalyticsHistory,
  createPost,
} = require("../models/social");

const router = express.Router();

// Configuration
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

// GET /api/me - Get current user profile
router.get("/me", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { query } = require("../config/database");

    if (!userId) {
      return res.status(404).json({ error: "No User Id provided" });
    }

    const result = await query(
      "SELECT user_id, name, email, interests, created_at FROM users WHERE user_id = $1",
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// GET /api/discord/auth-url - Get Discord OAuth URL
router.get("/discord/auth-url", async (req, res) => {
  try {
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_REDIRECT_URI =
      process.env.DISCORD_REDIRECT_URI ||
      "http://localhost:5173/auth/discord/callback";

    if (!DISCORD_CLIENT_ID) {
      return res.status(500).json({ error: "Discord client not configured" });
    }

    const scopes = "identify guilds messages.read";
    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}`;

    res.json({ url: oauthUrl });
  } catch (error) {
    logger.error("Error generating Discord auth URL:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// GET /api/accounts
router.get("/accounts", async (req, res) => {
  try {
    const userId = req.user.userId;
    const accounts = await findSocialAccountsByUserId(userId);

    res.json({ accounts });
  } catch (error) {
    logger.error("Error fetching accounts:", error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

async function publishToDiscord(account, { content, imageUrl }) {
  const webhookUrl = account.webhook_url || account.platform_data?.webhook_url;
  if (!webhookUrl) {
    throw new Error("Discord webhook not configured. Add one in Inbox first.");
  }

  const payload = {
    content: content.trim(),
    username: account.account_name || "Social Media Hub",
  };

  if (imageUrl) {
    payload.embeds = [{ image: { url: imageUrl } }];
  }

  const response = await axios.post(webhookUrl, payload);

  return {
    platform: "discord",
    status: "published",
    platformPostId: response.data?.id || null,
  };
}

async function publishToFacebook(account, { content, imageUrl }) {
  const pageId = account.platform_data?.page_id || account.account_handle;
  const pageAccessToken = account.access_token;
  const metaApiVersion = process.env.META_API_VERSION || "v22.0";

  try {
    const endpoint = imageUrl
      ? `https://graph.facebook.com/${metaApiVersion}/${pageId}/photos`
      : `https://graph.facebook.com/${metaApiVersion}/${pageId}/feed`;

    const params = imageUrl
      ? { url: imageUrl, caption: content, access_token: pageAccessToken }
      : { message: content, access_token: pageAccessToken };

    const response = await axios.post(endpoint, null, { params });

    return {
      platform: "facebook",
      status: "published",
      platformPostId: response.data?.id || response.data?.post_id || null,
    };
  } catch (error) {
    const errorPayload = error.response?.data;
    const errorMessage =
      errorPayload?.error?.message ||
      errorPayload?.message ||
      error.message ||
      "Facebook publish failed";

    logger.error("Facebook publish failed", {
      pageId,
      status: error.response?.status,
      error: errorPayload,
    });

    throw new Error(errorMessage);
  }
}

async function publishToInstagram(account, { content, imageUrl }) {
  if (!imageUrl) {
    throw new Error(
      "Instagram publishing requires an image URL. Add one to publish this post.",
    );
  }

  const igUserId = account.platform_data?.instagram_user_id;
  const pageAccessToken = account.access_token;
  const metaApiVersion = process.env.META_API_VERSION || "v22.0";

  const containerResponse = await axios.post(
    `https://graph.facebook.com/${metaApiVersion}/${igUserId}/media`,
    null,
    {
      params: {
        image_url: imageUrl,
        caption: content,
        access_token: pageAccessToken,
      },
    },
  );

  const creationId = containerResponse.data?.id;
  if (!creationId) {
    throw new Error("Instagram media container was not created.");
  }

  const publishResponse = await axios.post(
    `https://graph.facebook.com/${metaApiVersion}/${igUserId}/media_publish`,
    null,
    {
      params: {
        creation_id: creationId,
        access_token: pageAccessToken,
      },
    },
  );

  return {
    platform: "instagram",
    status: "published",
    platformPostId: publishResponse.data?.id || null,
  };
}

async function publishToYouTube(account, { content }) {
  throw new Error(
    "YouTube publishing is not supported yet because it requires video upload workflows and media handling.",
  );
}

router.post("/publish", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content, imageUrl, platforms } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: "Post content is required." });
    }

    const accounts = await findSocialAccountsByUserId(userId);
    const connectedAccounts = accounts.filter(
      (account) => account.is_connected !== false,
    );

    const requestedPlatforms =
      Array.isArray(platforms) && platforms.length > 0
        ? platforms
        : connectedAccounts.map((account) => account.platform);

    const uniquePlatforms = [...new Set(requestedPlatforms.filter(Boolean))];
    const results = [];

    for (const platform of uniquePlatforms) {
      const account = connectedAccounts.find(
        (item) => item.platform === platform,
      );

      if (!account) {
        results.push({
          platform,
          status: "skipped",
          reason: "This platform is not connected for your account.",
        });
        continue;
      }

      try {
        let publishResult;
        if (platform === "discord") {
          publishResult = await publishToDiscord(account, {
            content,
            imageUrl,
          });
        } else if (platform === "facebook") {
          publishResult = await publishToFacebook(account, {
            content,
            imageUrl,
          });
        } else if (platform === "instagram") {
          publishResult = await publishToInstagram(account, {
            content,
            imageUrl,
          });
        } else if (platform === "youtube") {
          publishResult = await publishToYouTube(account, { content });
        } else {
          throw new Error(`Publishing for ${platform} is not supported yet.`);
        }

        await createPost({
          userId,
          accountId: account.account_id,
          platformPostId: publishResult.platformPostId,
          content: content.trim(),
          imageUrl: imageUrl || null,
          videoUrl: null,
          publishDate: new Date(),
          postType: platform === "instagram" ? "image" : "text",
          postData: {
            platform,
            publishedAt: new Date().toISOString(),
          },
        });

        results.push(publishResult);
      } catch (error) {
        results.push({
          platform,
          status: "failed",
          error: error.message,
        });
      }
    }

    const publishedCount = results.filter(
      (result) => result.status === "published",
    ).length;

    res.json({
      success: publishedCount > 0,
      publishedCount,
      results,
      message:
        publishedCount > 0
          ? `Published to ${publishedCount} platform(s).`
          : "No posts were published. Check the platform-specific requirements above.",
    });
  } catch (error) {
    logger.error("Error publishing content:", error.message);
    res.status(500).json({ error: "Failed to publish content" });
  }
});

// GET /api/analytics - Get latest analytics for all connected accounts
router.get("/analytics", async (req, res) => {
  try {
    const userId = req.user.userId;
    logger.info(`[API] Fetching analytics history for user_id: ${userId}`);

    const analyticsRows = await getUserAnalyticsHistory(userId);

    if (!analyticsRows || analyticsRows.length === 0) {
      logger.warn(`[API] No analytics data found for user_id: ${userId}`);
      return res.json({
        platforms: [],
        message:
          "No analytics data available. Connect accounts and wait for scheduler to collect data.",
      });
    }

    const platforms = transformAnalyticsForFrontend(analyticsRows);
    logger.info(
      `[API] Returning analytics for ${platforms.length} platform(s)`,
    );
    res.json({ platforms });
  } catch (error) {
    logger.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// GET /api/analytics/:accountId - Get analytics history for a specific account
router.get("/analytics/:accountId", async (req, res) => {
  try {
    const userId = req.user.userId;
    const accountId = req.params.accountId;
    const limit = parseInt(req.query.limit) || 30;

    logger.info(
      `[API] Fetching analytics history for account_id: ${accountId}`,
    );

    const history = await getAnalyticsHistory(accountId, limit);

    res.json({ accountId, history });
  } catch (error) {
    logger.error("Error fetching analytics history:", error);
    res.status(500).json({ error: "Failed to fetch analytics history" });
  }
});

// Helper function to transform analytics data for frontend
function transformAnalyticsForFrontend(analyticsRows) {
  // Group rows by platform
  const platformMap = new Map();

  for (const record of analyticsRows) {
    const platform = record.platform;

    if (!platformMap.has(platform)) {
      platformMap.set(platform, {
        id: platform,
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        totalFollowers: 0,
        totalPosts: 0,
        avgEngagementRate: "0",
        metrics: {
          audienceGrowth: [], // will be filled from real daily records
          postEngagement: { likes: 0, comments: 0, shares: 0, total: 0 },
        },
        // keyed by calendar date string "YYYY-MM-DD", value = latest record for that day
        _dailyRecords: new Map(),
        _latestRecord: null,
      });
    }

    const platformData = platformMap.get(platform);
    const dateKey = new Date(record.collected_date).toISOString().slice(0, 10); // "YYYY-MM-DD"

    // DISTINCT ON in SQL already gives us the latest per day, but just in case:
    if (!platformData._dailyRecords.has(dateKey)) {
      platformData._dailyRecords.set(dateKey, record);
    }

    // Track the most recent record overall for KPIs
    if (
      !platformData._latestRecord ||
      new Date(record.collected_date) >
        new Date(platformData._latestRecord.collected_date)
    ) {
      platformData._latestRecord = record;
    }
  }

  const result = [];

  for (const [_, platformData] of platformMap) {
    const latest = platformData._latestRecord;

    // KPIs from most recent record
    platformData.totalFollowers = latest.followers || 0;
    platformData.totalPosts =
      latest.analytics_data?.media_count ||
      latest.analytics_data?.video_count ||
      latest.analytics_data?.total_posts ||
      0;
    platformData.avgEngagementRate = latest.engagement_rate
      ? String(latest.engagement_rate)
      : "0";

    // Post engagement summed across all records in the window
    // (gives a 7-day total which is more meaningful than a single snapshot)
    let totalLikes = 0,
      totalComments = 0,
      totalShares = 0;
    for (const [, record] of platformData._dailyRecords) {
      totalLikes += record.likes || 0;
      totalComments += record.comments || 0;
      totalShares += record.shares || 0;
    }
    platformData.metrics.postEngagement = {
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      total: totalLikes + totalComments + totalShares,
    };

    // Audience growth — one real bar per day we have data for, sorted ascending
    const dayAbbrev = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    platformData.metrics.audienceGrowth = Array.from(
      platformData._dailyRecords.entries(),
    )
      .sort(([a], [b]) => a.localeCompare(b)) // sort by date string ascending
      .map(([dateStr, record]) => ({
        day: dayAbbrev[new Date(dateStr).getDay()],
        date: dateStr,
        value: record.followers || 0,
      }));

    // Clean up internal working fields before sending to frontend
    delete platformData._dailyRecords;
    delete platformData._latestRecord;

    result.push(platformData);
  }

  return result;
}

// GET /api/inbox - Get Discord inbox data
router.get("/inbox", async (req, res) => {
  try {
    const userId = req.user.userId;
    const axios = require("axios");

    // Check if Discord is connected
    const discordAccount = await findSocialAccountByPlatform(userId, "discord");

    if (!discordAccount) {
      return res.json({
        connected: false,
        message: "Connect Discord to use the inbox feature",
      });
    }

    // Check if token is expired
    if (
      discordAccount.token_expiry &&
      new Date() > new Date(discordAccount.token_expiry)
    ) {
      return res.json({
        connected: false,
        message: "Discord token expired. Please reconnect.",
      });
    }

    // Fetch guilds (servers)
    const guildsResponse = await axios.get(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: { Authorization: `Bearer ${discordAccount.access_token}` },
      },
    );

    // Fetch recent DMs/channels
    const channelsResponse = await axios.get(
      "https://discord.com/api/users/@me/channels",
      {
        headers: { Authorization: `Bearer ${discordAccount.access_token}` },
      },
    );

    // Get user info
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${discordAccount.access_token}` },
    });

    const discordUser = userResponse.data;
    const guilds = guildsResponse.data || [];
    const channels = channelsResponse.data || [];

    // Get channel details for DMs
    const channelDetails = await Promise.all(
      channels.slice(0, 5).map(async (channel) => {
        try {
          if (channel.recipients && channel.recipients.length > 0) {
            const recipientResponse = await axios.get(
              `https://discord.com/api/users/${channel.recipients[0]}`,
              {
                headers: {
                  Authorization: `Bearer ${discordAccount.access_token}`,
                },
              },
            );
            return {
              id: channel.id,
              type: "dm",
              recipient: {
                id: recipientResponse.data.id,
                username: recipientResponse.data.username,
                avatar: recipientResponse.data.avatar,
              },
              last_message_id: channel.last_message_id,
            };
          }
          return { id: channel.id, type: "group" };
        } catch {
          return { id: channel.id, type: "group" };
        }
      }),
    );

    res.json({
      connected: true,
      user: {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
      },
      servers: guilds.slice(0, 20).map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
          : null,
        owner: g.owner,
        permissions: g.permissions,
      })),
      recentMessages: channelDetails,
      totalServers: guilds.length,
      totalConversations: channels.length,
    });
  } catch (error) {
    logger.error(
      "Error fetching inbox:",
      error.response?.data || error.message,
    );

    // If token is invalid, return not connected
    if (error.response?.status === 401) {
      return res.json({
        connected: false,
        message: "Discord connection expired. Please reconnect.",
      });
    }

    res.status(500).json({ error: "Failed to fetch inbox data" });
  }
});

// DELETE /api/accounts/:accountId
router.delete("/accounts/:accountId", async (req, res) => {
  try {
    const userId = req.user.userId;
    const accountId = req.params.accountId;

    const { query } = require("../config/database");

    // Check if account belongs to user
    const accountResult = await query(
      "SELECT * FROM social_account WHERE account_id = $1 AND user_id = $2",
      [accountId, userId],
    );
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Delete the account
    await query("DELETE FROM social_account WHERE account_id = $1", [
      accountId,
    ]);

    res.json({ message: "Account disconnected successfully" });
  } catch (error) {
    logger.error("Error disconnecting account:", error);
    res.status(500).json({ error: "Failed to disconnect account" });
  }
});

module.exports = router;
