const { query } = require("../config/database");

// Social Account functions
async function createSocialAccount(accountData) {
  const {
    userId,
    platform,
    accountHandle,
    accountName,
    profilePictureUrl,
    accessToken,
    refreshToken,
    tokenExpiry,
    platformData = {},
  } = accountData;

  const result = await query(
    `INSERT INTO social_account
     (user_id, platform, account_handle, account_name, profile_picture_url,
      access_token, refresh_token, token_expiry, platform_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      platform,
      accountHandle,
      accountName,
      profilePictureUrl,
      accessToken,
      refreshToken,
      tokenExpiry,
      JSON.stringify(platformData),
    ],
  );

  return result.rows[0];
}

async function findSocialAccountById(accountId) {
  const result = await query(
    "SELECT * FROM social_account WHERE account_id = $1",
    [accountId],
  );

  return result.rows[0] || null;
}

async function findSocialAccountsByUserId(userId) {
  const result = await query(
    "SELECT * FROM social_account WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );

  return result.rows;
}

async function findSocialAccountByPlatform(
  userId,
  platform,
  accountHandle = null,
) {
  let queryText =
    "SELECT * FROM social_account WHERE user_id = $1 AND platform = $2";
  let params = [userId, platform];

  if (accountHandle) {
    queryText += " AND account_handle = $3";
    params.push(accountHandle);
  }

  const result = await query(queryText, params);
  return result.rows[0] || null;
}

async function updateSocialAccountToken(
  accountId,
  accessToken,
  refreshToken = null,
  tokenExpiry = null,
  is_connected = true,
) {
  const result = await query(
    `UPDATE social_account
     SET access_token = $1, refresh_token = $2, token_expiry = $3, updated_at = CURRENT_TIMESTAMP, is_connected = $4
     WHERE account_id = $5
     RETURNING *`,
    [accessToken, refreshToken, tokenExpiry, is_connected, accountId],
  );

  return result.rows[0];
}

// Analytics functions
async function createAnalytics(analyticsData) {
  const {
    accountId,
    followers,
    following,
    likes,
    comments,
    shares,
    impressions,
    reach,
    engagementRate,
    analyticsData: analyticsJSON,
  } = analyticsData;

  const result = await query(
    `INSERT INTO analytics
     (account_id, followers, following, likes, comments, shares, impressions, reach, engagement_rate, analytics_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      accountId,
      followers,
      following,
      likes,
      comments,
      shares,
      impressions,
      reach,
      engagementRate,
      JSON.stringify(analyticsJSON),
    ],
  );

  return result.rows[0];
}

async function getLatestAnalytics(accountId) {
  const result = await query(
    "SELECT * FROM analytics WHERE account_id = $1 ORDER BY collected_date DESC LIMIT 1",
    [accountId],
  );

  return result.rows[0] || null;
}

async function getAnalyticsHistory(accountId, limit = 30) {
  const result = await query(
    "SELECT * FROM analytics WHERE account_id = $1 ORDER BY collected_date DESC LIMIT $2",
    [accountId, limit],
  );

  return result.rows;
}

// Get analytics for all accounts of a user (for detailed analytics view)
async function getUserAnalytics(userId) {
  const result = await query(
    `SELECT a.*, sa.platform, sa.account_handle, sa.account_name, sa.profile_picture_url
     FROM analytics a
     JOIN social_account sa ON a.account_id = sa.account_id
     WHERE sa.user_id = $1
     ORDER BY a.collected_date DESC`,
    [userId],
  );

  return result.rows;
}

// Get latest analytics for all accounts of a user (one per account)
async function getUserLatestAnalytics(userId) {
  const result = await query(
    `SELECT a.*, sa.platform, sa.account_handle, sa.account_name, sa.profile_picture_url
     FROM analytics a
     JOIN social_account sa ON a.account_id = sa.account_id
     WHERE sa.user_id = $1
     AND a.collected_date = (
       SELECT MAX(a2.collected_date)
       FROM analytics a2
       WHERE a2.account_id = a.account_id
     )
     ORDER BY sa.platform`,
    [userId],
  );

  return result.rows;
}

// Get last 7 days of analytics for all accounts of a user, one record per account per calendar day
async function getUserAnalyticsHistory(userId) {
  const result = await query(
    `SELECT DISTINCT ON (sa.account_id, DATE(a.collected_date))
       a.*,
       sa.platform,
       sa.account_handle,
       sa.account_name,
       sa.profile_picture_url
     FROM analytics a
     JOIN social_account sa ON a.account_id = sa.account_id
     WHERE sa.user_id = $1
       AND a.collected_date >= NOW() - INTERVAL '7 days'
     ORDER BY sa.account_id, DATE(a.collected_date), a.collected_date DESC`,
    [userId],
  );

  return result.rows;
}

// Post functions
async function createPost(postData) {
  const {
    userId,
    accountId,
    platformPostId,
    content,
    imageUrl,
    videoUrl,
    publishDate,
    postType,
    postData: postJSON = {},
  } = postData;

  const result = await query(
    `INSERT INTO post
     (user_id, account_id, platform_post_id, content, image_url, video_url, publish_date, post_type, post_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      accountId,
      platformPostId,
      content,
      imageUrl,
      videoUrl,
      publishDate,
      postType,
      JSON.stringify(postJSON),
    ],
  );

  return result.rows[0];
}

async function getPostsByAccount(accountId, limit = 20) {
  const result = await query(
    "SELECT * FROM post WHERE account_id = $1 ORDER BY publish_date DESC LIMIT $2",
    [accountId, limit],
  );

  return result.rows;
}

async function updateDiscordWebhook(accountId, webhookUrl) {
  const result = await query(
    `UPDATE social_account
     SET platform_data = COALESCE(platform_data, '{}'::jsonb) || $1::jsonb,
         updated_at = CURRENT_TIMESTAMP, webhook_url = $3
     WHERE account_id = $2
     RETURNING *`,
    [JSON.stringify({ webhook_url: webhookUrl }), accountId, webhookUrl],
  );
  return result.rows[0];
}

module.exports = {
  // Social Account
  createSocialAccount,
  findSocialAccountById,
  findSocialAccountsByUserId,
  findSocialAccountByPlatform,
  updateSocialAccountToken,

  // Analytics
  createAnalytics,
  getLatestAnalytics,
  getAnalyticsHistory,
  getUserAnalytics,
  getUserLatestAnalytics,
  getUserAnalyticsHistory,
  // Posts
  createPost,
  getPostsByAccount,

  // Webhooks
  updateDiscordWebhook,
};
