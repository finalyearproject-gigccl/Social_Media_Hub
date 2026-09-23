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

const router = express.Router();

// Configuration
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";
const REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? "https://yourdomain.com/auth/youtube/callback"
    : `http://localhost:3001/auth/youtube/callback`;

// YouTube OAuth scopes
const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

// Helper to get userId from token
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

// GET /auth/youtube - Start OAuth flow
router.get("/", (req, res) => {
  const userId = getUserIdFromRequest(req);

  if (!userId) {
    return res
      .status(401)
      .json({ error: "Authentication required. Please login first." });
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${YOUTUBE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${encodeURIComponent(
    YOUTUBE_SCOPES,
  )}&access_type=offline&state=${state}&prompt=consent`;

  logger.info(`Redirecting to YouTube auth URL for user: ${userId}`);
  res.redirect(authUrl);
});

// GET /auth/youtube/callback - Handle OAuth callback
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error("YouTube OAuth error:", error);
    return res
      .status(400)
      .type("html")
      .send(
        renderOAuthPage({
          platform: "YouTube",
          success: false,
          title: "YouTube connection failed",
          message:
            "Google did not complete the connection. Please close this window and try again.",
        }),
      );
  }

  if (!code) {
    return res.status(400).send("Authorization code not found");
  }

  let userId;
  try {
    const decodedState = JSON.parse(Buffer.from(state, "base64").toString());
    userId = decodedState.userId;
    logger.info(`Received YouTube callback for user ID: ${userId}`);
  } catch (error) {
    return res.status(400).send("Invalid state parameter");
  }

  try {
    // Step 1: Exchange code for access token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: YOUTUBE_CLIENT_ID,
        client_secret: YOUTUBE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    logger.info("Received YouTube access token");

    // Step 2: Get channel information
    const channelResponse = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        params: {
          mine: true,
          part: "snippet,statistics,contentOwnerDetails",
        },
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    const channels = channelResponse.data.items;
    if (!channels || channels.length === 0) {
      return res.status(400).send("No YouTube channel found for this account.");
    }

    const channel = channels[0];
    const channelId = channel.id;
    const channelName = channel.snippet.title;
    const channelPicture = channel.snippet.thumbnails?.default?.url || null;

    // Channel statistics
    const channelStats = {
      subscriberCount: channel.statistics.subscriberCount,
      videoCount: channel.statistics.videoCount,
      viewCount: channel.statistics.viewCount,
      hiddenSubscriberCount: channel.statistics.hiddenSubscriberCount,
    };

    // Step 3: Save or update social account
    const accountData = {
      userId,
      platform: "youtube",
      accountHandle: channelId,
      accountName: channelName,
      profilePictureUrl: channelPicture,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiry: tokenExpiry,
      isConnected: true,
      platformData: {
        channelId,
        channelName,
        ...channelStats,
      },
    };

    // Check if account exists
    const existingAccount = await findSocialAccountByPlatform(
      userId,
      "youtube",
      channelId,
    );

    if (existingAccount) {
      // Update existing account
      await updateSocialAccountToken(
        existingAccount.account_id,
        access_token,
        refresh_token,
        tokenExpiry,
      );
      logger.info(`Updated YouTube account for user ${userId}`);
    } else {
      // Create new account
      await createSocialAccount(accountData);
      logger.info(`Created YouTube account for user ${userId}`);
    }

    res.type("html").send(
      renderOAuthPage({
        platform: "YouTube",
        success: true,
        title: "YouTube is connected",
        message:
          "Your channel is now ready to use in the social media dashboard.",
        details: [{ label: "Channel", value: channelName }],
      }),
    );
  } catch (error) {
    logger.error("YouTube OAuth error:", error.response?.data || error.message);
    res
      .status(500)
      .type("html")
      .send(
        renderOAuthPage({
          platform: "YouTube",
          success: false,
          title: "YouTube connection failed",
          message:
            "We could not complete the connection. Please close this window and try again.",
        }),
      );
  }
});

// GET /auth/youtube/disconnect - Revoke YouTube connection
router.delete("/disconnect", async (req, res) => {
  const userId = getUserIdFromRequest(req);

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const accounts = await findSocialAccountsByUserId(userId);
    const youtubeAccount = accounts.find(
      (acc) => acc.platform === "youtube" && acc.is_connected,
    );

    if (!youtubeAccount) {
      return res.status(404).json({ error: "YouTube account not found" });
    }

    // Revoke the access token
    try {
      await axios.post(
        `https://oauth2.googleapis.com/revoke`,
        new URLSearchParams({
          token: youtubeAccount.access_token,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
    } catch (revokeError) {
      // Ignore revoke errors, just delete from DB
      logger.warn("Could not revoke YouTube token:", revokeError.message);
    }

    // Update account as disconnected
    await updateSocialAccountToken(
      youtubeAccount.account_id,
      null,
      null,
      null,
      false,
    );

    logger.info(`Disconnected YouTube account for user ${userId}`);
    res.json({ message: "YouTube account disconnected" });
  } catch (error) {
    logger.error("YouTube disconnect error:", error.message);
    res.status(500).json({ error: "Failed to disconnect YouTube account" });
  }
});

// GET /auth/youtube/channelSummary
router.get("/channelSummary", async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId)
    return res.status(401).json({ error: "Authentication required" });

  try {
    const accounts = await findSocialAccountsByUserId(userId);
    const youtubeAccount = accounts.find(
      (acc) => acc.platform === "youtube" && acc.is_connected,
    );

    if (!youtubeAccount)
      return res.status(404).json({ error: "YouTube account not connected" });

    // Token refresh check
    let accessToken = youtubeAccount.access_token;
    if (
      youtubeAccount.token_expiry &&
      new Date(youtubeAccount.token_expiry) < new Date()
    ) {
      const refreshResponse = await axios.post(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          refresh_token: youtubeAccount.refresh_token,
          grant_type: "refresh_token",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      accessToken = refreshResponse.data.access_token;
      const tokenExpiry = new Date(
        Date.now() + refreshResponse.data.expires_in * 1000,
      );
      await updateSocialAccountToken(
        youtubeAccount.account_id,
        accessToken,
        youtubeAccount.refresh_token,
        tokenExpiry,
      );
    }

    // Fetch channel info + uploads playlist ID in one call
    const channelResponse = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        params: { mine: true, part: "snippet,statistics,contentDetails" },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const channel = channelResponse.data.items[0];
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    // Fetch recent videos from uploads playlist
    const playlistResponse = await axios.get(
      "https://www.googleapis.com/youtube/v3/playlistItems",
      {
        params: {
          part: "snippet",
          playlistId: uploadsPlaylistId,
          maxResults: 10,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const videoIds = playlistResponse.data.items
      .map((item) => item.snippet.resourceId.videoId)
      .join(",");

    // Fetch video statistics
    let recentPosts = [];
    if (videoIds) {
      const statsResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: { part: "statistics,contentDetails,snippet", id: videoIds },
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      recentPosts = statsResponse.data.items.map((video) => ({
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails?.medium?.url,
        publishedAt: video.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.contentDetails?.duration,
        statistics: {
          views: parseInt(video.statistics?.viewCount || 0),
          likes: parseInt(video.statistics?.likeCount || 0),
          comments: parseInt(video.statistics?.commentCount || 0),
        },
      }));
    }

    // Final response — everything in one place
    res.json({
      platform: "youtube",
      channel: {
        channelId: channel.id,
        channelName: channel.snippet.title,
        description: channel.snippet.description,
        profilePicture: channel.snippet.thumbnails?.default?.url,
        customUrl: channel.snippet.customUrl,
        publishedAt: channel.snippet.publishedAt,
      },
      statistics: {
        subscribers: parseInt(channel.statistics.subscriberCount || 0),
        videos: parseInt(channel.statistics.videoCount || 0),
        totalViews: parseInt(channel.statistics.viewCount || 0),
        hiddenSubscribers: channel.statistics.hiddenSubscriberCount,
      },
      recentPosts,
    });
  } catch (error) {
    logger.error(
      "YouTube channelSummary error:",
      error.response?.data || error.message,
    );
    res.status(500).json({ error: "Failed to fetch YouTube channel summary" });
  }
});

module.exports = router;
