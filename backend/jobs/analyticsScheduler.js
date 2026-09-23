const cron = require("node-cron");
const axios = require("axios");
const logger = require("../utils/logger");
const { query } = require("../config/database");
const {
  findSocialAccountsByUserId,
  createAnalytics,
} = require("../models/social");

// Configuration
const INSTAGRAM_API_VERSION = process.env.INSTAGRAM_API_VERSION || "v18.0";
const SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED !== "false"; // Enable by default
const SCHEDULER_INTERVAL = process.env.SCHEDULER_INTERVAL || "0 */24 * * *"; // Every 24 hours by default

/**
 * Fetch analytics for a single Instagram account and store in DB
 */
async function fetchAndStoreInstagramAnalytics(account) {
  logger.info(
    `📡 [Instagram] Starting fetch for account_id: ${account.account_id}`,
  );
  try {
    if (account.token_expiry && new Date() > new Date(account.token_expiry)) {
      logger.warn(
        `⏭️ [Instagram] Skipping account ${account.account_handle}: token expired`,
      );
      return {
        success: false,
        reason: "Token expired",
        accountId: account.account_id,
      };
    }

    const GRAPH_API_VERSION = process.env.META_API_VERSION || "v19.0";

    // Get the Instagram Business Account ID from platform_data
    const platformData = account.platform_data || {};
    const igUserId = platformData.instagram_user_id;

    if (!igUserId) {
      logger.warn(
        `⏭️ [Instagram] No Instagram Business Account ID found for account ${account.account_handle}`,
      );
      return {
        success: false,
        reason: "No Instagram Business Account ID stored",
        accountId: account.account_id,
      };
    }

    // Fetch profile using Graph API (not Basic Display API)
    logger.info(`🌐 [Instagram] Fetching profile for IG user ${igUserId}...`);
    const profileResponse = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}`,
      {
        params: {
          fields:
            "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count",
          access_token: account.access_token,
        },
      },
    );

    // Fetch recent media
    logger.info(`🌐 [Instagram] Fetching recent media...`);
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`,
      {
        params: {
          fields: "id,caption,media_type,timestamp,like_count,comments_count",
          limit: 10,
          access_token: account.access_token,
        },
      },
    );

    const recentMedia = mediaResponse.data.data || [];
    const totalLikes = recentMedia.reduce(
      (sum, post) => sum + (post.like_count || 0),
      0,
    );
    const totalComments = recentMedia.reduce(
      (sum, post) => sum + (post.comments_count || 0),
      0,
    );
    const totalEngagement = totalLikes + totalComments;
    const followers = profileResponse.data.followers_count || 1;
    const engagementRate =
      recentMedia.length > 0
        ? Math.min((totalEngagement / followers) * 100, 999.99).toFixed(2)
        : 0;

    await createAnalytics({
      accountId: account.account_id,
      followers: profileResponse.data.followers_count || 0,
      following: profileResponse.data.follows_count || 0,
      likes: totalLikes,
      comments: totalComments,
      shares: 0,
      impressions: null,
      reach: null,
      engagementRate: parseFloat(engagementRate),
      analyticsData: {
        ...profileResponse.data,
        recent_media: recentMedia,
        engagement_rate: engagementRate,
      },
    });

    logger.info(
      `✅ [Instagram] Analytics stored for ${account.account_handle}`,
    );
    return {
      success: true,
      accountId: account.account_id,
      platform: account.platform,
      handle: account.account_handle,
    };
  } catch (error) {
    logger.error(
      `❌ [Instagram] Error for account ${account.account_handle}:`,
      error.response?.data?.error?.message || error.message,
    );
    return {
      success: false,
      reason: error.message,
      accountId: account.account_id,
    };
  }
}

/**
 * Fetch analytics for a single YouTube account and store in DB
 */
async function fetchAndStoreYouTubeAnalytics(account) {
  logger.info(
    `📡 [YouTube] Starting fetch for account_id: ${account.account_id}`,
  );
  try {
    if (account.token_expiry && new Date() > new Date(account.token_expiry)) {
      // Attempt token refresh if refresh_token exists
      if (!account.refresh_token) {
        logger.warn(
          `⏭️ [YouTube] Token expired and no refresh token for ${account.account_handle}`,
        );
        return {
          success: false,
          reason: "Token expired, no refresh token",
          accountId: account.account_id,
        };
      }

      logger.info(
        `🔄 [YouTube] Refreshing access token for ${account.account_handle}...`,
      );
      const refreshResponse = await axios.post(
        "https://oauth2.googleapis.com/token",
        {
          client_id: process.env.YOUTUBE_CLIENT_ID,
          client_secret: process.env.YOUTUBE_CLIENT_SECRET,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        },
      );

      const newAccessToken = refreshResponse.data.access_token;
      const newExpiry = new Date(
        Date.now() + refreshResponse.data.expires_in * 1000,
      );

      // Update token in DB
      const { updateSocialAccountToken } = require("../models/social");
      await updateSocialAccountToken(
        account.account_id,
        newAccessToken,
        account.refresh_token,
        newExpiry,
      );
      account.access_token = newAccessToken;
      logger.info(`✅ [YouTube] Token refreshed for ${account.account_handle}`);
    }

    // Fetch channel statistics
    logger.info(`🌐 [YouTube] Fetching channel statistics...`);
    const channelResponse = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        params: {
          part: "statistics,snippet",
          mine: true,
        },
        headers: { Authorization: `Bearer ${account.access_token}` },
      },
    );

    if (
      !channelResponse.data.items ||
      channelResponse.data.items.length === 0
    ) {
      throw new Error("No YouTube channel found for this account");
    }

    const channel = channelResponse.data.items[0];
    const stats = channel.statistics;
    const subscriberCount = parseInt(stats.subscriberCount) || 0;
    const videoCount = parseInt(stats.videoCount) || 0;

    // Fetch recent video IDs via search
    logger.info(`🌐 [YouTube] Fetching recent video IDs...`);
    const searchResponse = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "id",
          channelId: channel.id,
          order: "date",
          maxResults: 10,
          type: "video",
        },
        headers: { Authorization: `Bearer ${account.access_token}` },
      },
    );

    const videoIds = (searchResponse.data.items || [])
      .map((v) => v.id.videoId)
      .filter(Boolean);

    let totalLikes = 0;
    let totalComments = 0;

    if (videoIds.length > 0) {
      // Fetch per-video statistics (this is where real likes/comments live)
      logger.info(
        `🌐 [YouTube] Fetching per-video statistics for ${videoIds.length} videos...`,
      );
      const videoStatsResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: {
            part: "statistics",
            id: videoIds.join(","),
          },
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      for (const video of videoStatsResponse.data.items || []) {
        totalLikes += parseInt(video.statistics.likeCount) || 0;
        totalComments += parseInt(video.statistics.commentCount) || 0;
      }
    }

    const totalEngagement = totalLikes + totalComments;
    const engagementRate =
      subscriberCount > 0
        ? Math.min((totalEngagement / subscriberCount) * 100, 999.99).toFixed(2)
        : 0;

    logger.info(
      `📊 [YouTube] Metrics — Subscribers: ${subscriberCount}, Likes: ${totalLikes}, Comments: ${totalComments}, Engagement: ${engagementRate}%`,
    );

    await createAnalytics({
      accountId: account.account_id,
      followers: subscriberCount,
      following: 0,
      likes: totalLikes,
      comments: totalComments,
      shares: 0,
      impressions: parseInt(stats.viewCount) || 0,
      reach: parseInt(stats.viewCount) || 0,
      engagementRate: parseFloat(engagementRate),
      analyticsData: {
        channel_id: channel.id,
        channel_title: channel.snippet.title,
        video_count: videoCount,
        view_count: parseInt(stats.viewCount) || 0,
        recent_video_ids: videoIds,
        engagement_rate: engagementRate,
      },
    });

    logger.info(`✅ [YouTube] Analytics stored for ${account.account_handle}`);
    return {
      success: true,
      accountId: account.account_id,
      platform: account.platform,
      handle: account.account_handle,
    };
  } catch (error) {
    logger.error(
      `❌ [YouTube] Error for account ${account.account_handle}:`,
      error.response?.data?.error?.message || error.message,
    );
    return {
      success: false,
      reason: error.message,
      accountId: account.account_id,
    };
  }
}

/**
 * Fetch analytics for a single Meta (Facebook) account and store in DB
 */
async function fetchAndStoreMetaAnalytics(account) {
  logger.info(`📡 [Meta] Starting fetch for account_id: ${account.account_id}`);
  try {
    if (account.token_expiry && new Date() > new Date(account.token_expiry)) {
      logger.warn(
        `⏭️ [Meta] Skipping account ${account.account_handle}: token expired`,
      );
      return {
        success: false,
        reason: "Token expired",
        accountId: account.account_id,
      };
    }

    const META_API_VERSION = process.env.META_API_VERSION || "v19.0";
    const platformData = account.platform_data || {};
    const pageId = platformData.page_id;
    const pageAccessToken = account.access_token;

    if (!pageId) {
      logger.warn(
        `⏭️ [Meta] No Page ID found in platform_data for ${account.account_handle}`,
      );
      return {
        success: false,
        reason: "No Page ID stored in platform_data",
        accountId: account.account_id,
      };
    }

    // Fetch page info
    logger.info(`🌐 [Meta] Fetching page info for page ${pageId}...`);
    const pageInfoResponse = await axios.get(
      `https://graph.facebook.com/${META_API_VERSION}/${pageId}`,
      {
        params: {
          fields: "id,name,fan_count,followers_count,link",
          access_token: pageAccessToken,
        },
      },
    );

    // Fetch recent posts for engagement metrics
    logger.info(`🌐 [Meta] Fetching recent posts...`);
    let totalLikes = 0;
    let totalComments = 0;
    let totalPosts = 0;
    try {
      const postsResponse = await axios.get(
        `https://graph.facebook.com/${META_API_VERSION}/${pageId}/posts`,
        {
          params: {
            fields: "id,likes.summary(true),comments.summary(true)",
            limit: 10,
            access_token: pageAccessToken,
          },
        },
      );
      const posts = postsResponse.data?.data || [];
      totalPosts = posts.length;
      totalLikes = posts.reduce(
        (sum, post) => sum + (post.likes?.summary?.total_count || 0),
        0,
      );
      totalComments = posts.reduce(
        (sum, post) => sum + (post.comments?.summary?.total_count || 0),
        0,
      );
      logger.info(
        `📝 [Meta] Posts — Count: ${totalPosts}, Likes: ${totalLikes}, Comments: ${totalComments}`,
      );
    } catch (postsErr) {
      logger.warn(
        `⚠️ [Meta] Posts unavailable for page ${pageId}: ${postsErr.response?.data?.error?.message || postsErr.message}`,
      );
    }

    // Fetch page insights — wrapped so a failure doesn't kill the whole store
    logger.info(`🌐 [Meta] Fetching page insights...`);
    let impressions = 0;
    let engagedUsers = 0;
    try {
      const pageInsightsResponse = await axios.get(
        `https://graph.facebook.com/${META_API_VERSION}/${pageId}/insights`,
        {
          params: {
            metric: "page_impressions_unique,page_post_engagements",
            period: "day",
            access_token: pageAccessToken,
          },
        },
      );
      const insights = pageInsightsResponse.data?.data || [];
      const getInsightValue = (metricName) => {
        const metric = insights.find((i) => i.name === metricName);
        return metric?.values?.[0]?.value || 0;
      };
      impressions = getInsightValue("page_impressions_unique");
      engagedUsers = getInsightValue("page_post_engagements");
    } catch (insightErr) {
      logger.warn(
        `⚠️ [Meta] Insights unavailable for page ${pageId}: ${insightErr.response?.data?.error?.message || insightErr.message}`,
      );
    }

    const pageInfo = pageInfoResponse.data;
    const followers = pageInfo.followers_count || pageInfo.fan_count || 0;
    const totalEngagement = engagedUsers || totalLikes + totalComments;
    const engagementRate =
      followers > 0
        ? Math.min((totalEngagement / followers) * 100, 999.99).toFixed(2)
        : 0;

    logger.info(
      `📊 [Meta] Metrics — Followers: ${followers}, Impressions: ${impressions}, Engaged: ${engagedUsers}, Engagement: ${engagementRate}%`,
    );

    await createAnalytics({
      accountId: account.account_id,
      followers,
      following: 0,
      likes: totalLikes, // was: pageInfo.fan_count || 0
      comments: totalComments, // was: 0
      shares: 0,
      impressions,
      reach: engagedUsers,
      engagementRate: parseFloat(engagementRate),
      analyticsData: {
        page_id: pageInfo.id,
        page_name: pageInfo.name,
        page_link: pageInfo.link,
        total_posts: totalPosts,
        impressions,
        engaged_users: engagedUsers,
        engagement_rate: engagementRate,
      },
    });

    logger.info(`✅ [Meta] Analytics stored for ${account.account_handle}`);
    return {
      success: true,
      accountId: account.account_id,
      platform: account.platform,
      handle: account.account_handle,
    };
  } catch (error) {
    logger.error(
      `❌ [Meta] Error for account ${account.account_handle}:`,
      error.response?.data?.error?.message || error.message,
    );
    return {
      success: false,
      reason: error.message,
      accountId: account.account_id,
    };
  }
}

/**
 * Dispatch analytics fetch based on platform
 */
async function fetchAndStoreAnalytics(account) {
  logger.info(
    `🔔 [Dispatcher] Processing account_id: ${account.account_id}, platform: ${account.platform}`,
  );

  switch (account.platform) {
    case "instagram":
      logger.info(`➡️ [Dispatcher] Routing to Instagram handler`);
      return await fetchAndStoreInstagramAnalytics(account);
    case "youtube":
      logger.info(`➡️ [Dispatcher] Routing to YouTube handler`);
      return await fetchAndStoreYouTubeAnalytics(account);
    case "facebook":
    case "meta":
      logger.info(`➡️ [Dispatcher] Routing to Meta handler`);
      return await fetchAndStoreMetaAnalytics(account);
    default:
      logger.warn(`⚠️ [Dispatcher] Platform ${account.platform} not supported`);
      return {
        success: false,
        reason: `Platform ${account.platform} not supported`,
        accountId: account.account_id,
      };
  }
}

/**
 * Main scheduler function - runs periodically
 */
async function runAnalyticsScheduler() {
  logger.info("========================================");
  logger.info("🔄 Starting analytics scheduler...");
  logger.info("========================================");
  const startTime = Date.now();

  try {
    // Get all users
    logger.info("📋 [Scheduler] Fetching all users from database...");
    const usersResult = await query("SELECT user_id FROM users");
    const users = usersResult.rows;

    if (users.length === 0) {
      logger.warn("⚠️ [Scheduler] No users found in database");
      return;
    }

    logger.info(`📋 [Scheduler] Found ${users.length} user(s)`);

    const results = {
      totalUsers: users.length,
      totalAccounts: 0,
      successfulStores: 0,
      failedStores: 0,
      accounts: [],
    };

    // Process each user
    for (const user of users) {
      logger.info(`👤 [Scheduler] Processing user_id: ${user.user_id}`);
      try {
        // Get all social accounts for this user
        const accounts = await findSocialAccountsByUserId(user.user_id);

        if (accounts.length === 0) {
          logger.debug(
            `⚠️ [Scheduler] No social accounts found for user ${user.user_id}`,
          );
          continue;
        }

        logger.info(
          `📱 [Scheduler] Found ${accounts.length} account(s) for user ${user.user_id}`,
        );
        results.totalAccounts += accounts.length;

        // Process each account
        for (const account of accounts) {
          logger.info(
            `🔃 [Scheduler] Processing account_id: ${account.account_id} (${account.platform})`,
          );

          // Skip if account is marked as disconnected
          if (account.is_connected === false) {
            logger.info(
              `⏭️ [Scheduler] Skipping disconnected account: ${account.account_handle}`,
            );
            continue;
          }

          // Fetch and store analytics based on platform
          const storeResult = await fetchAndStoreAnalytics(account);
          results.accounts.push(storeResult);

          if (storeResult.success) {
            results.successfulStores++;
            logger.info(
              `✅ [Scheduler] Successfully stored analytics for account_id: ${account.account_id}`,
            );
          } else {
            results.failedStores++;
            logger.warn(
              `❌ [Scheduler] Failed to store analytics for account_id: ${account.account_id} - ${storeResult.reason}`,
            );
          }
        }
      } catch (error) {
        logger.error(
          `❌ [Scheduler] Error processing user ${user.user_id}:`,
          error.message,
        );
        results.failedStores++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info("========================================");
    logger.info(`📊 Analytics Scheduler Completed:
      ├─ Users processed: ${results.totalUsers}
      ├─ Accounts processed: ${results.totalAccounts}
      ├─ Successful stores: ${results.successfulStores}
      ├─ Failed stores: ${results.failedStores}
      └─ Duration: ${duration}s
    `);
    logger.info("========================================");

    return results;
  } catch (error) {
    logger.error("❌ Fatal error in analytics scheduler:", error);
  }
}

/**
 * Initialize the scheduler
 */
function initializeScheduler() {
  if (!SCHEDULER_ENABLED) {
    logger.warn(
      "📛 Analytics Scheduler is DISABLED (set SCHEDULER_ENABLED=true to enable)",
    );
    return null;
  }

  try {
    logger.info(
      `⏰ Initializing Analytics Scheduler (interval: ${SCHEDULER_INTERVAL})`,
    );

    // Schedule the job
    const scheduledJob = cron.schedule(SCHEDULER_INTERVAL, () => {
      runAnalyticsScheduler();
    });

    logger.info("✅ Analytics Scheduler initialized successfully");

    // Run immediately on startup
    logger.info("📥 Running initial analytics sync on startup...");
    runAnalyticsScheduler();

    return scheduledJob;
  } catch (error) {
    logger.error("Failed to initialize scheduler:", error);
    return null;
  }
}

/**
 * Manual trigger function (for testing or forced updates)
 */
async function triggerAnalyticsSync() {
  logger.info("🔁 Manual analytics sync triggered");
  return await runAnalyticsScheduler();
}

module.exports = {
  initializeScheduler,
  triggerAnalyticsSync,
  runAnalyticsScheduler,
};
