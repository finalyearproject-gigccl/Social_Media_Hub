const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();
const { authenticateRequest } = require("../middleware/authMiddleware");
const {
  createSocialAccount,
  findSocialAccountByPlatform,
  updateSocialAccountToken,
  updateDiscordWebhook,
} = require("../models/social");
const logger = require("../utils/logger");

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  "http://localhost:3001/auth/discord/callback";
const stateMap = new Map(); // state token → userId

// Returns a valid access token, refreshing it first if expired
async function getValidAccessToken(discordAccount) {
  const isExpired =
    !discordAccount.token_expiry ||
    new Date() >= new Date(discordAccount.token_expiry);

  if (!isExpired) return discordAccount.access_token;

  logger.info(
    `Refreshing Discord token for account ${discordAccount.account_id}`,
  );

  const refreshResponse = await axios.post(
    "https://discord.com/api/oauth2/token",
    new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: discordAccount.refresh_token,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  const { access_token, refresh_token, expires_in } = refreshResponse.data;
  const tokenExpiry = new Date(Date.now() + expires_in * 1000);

  await updateSocialAccountToken(
    discordAccount.account_id,
    access_token,
    refresh_token,
    tokenExpiry,
  );

  return access_token;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

// Generate OAuth URL — embeds userId in state so callback knows who to save to
router.get("/auth/url", authenticateRequest, (req, res) => {
  const userId = req.user.userId;
  const state = crypto.randomBytes(16).toString("hex");
  stateMap.set(state, userId); // store mapping
  const scopes = "identify guilds";
  const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`; // use state token, not userId
  res.json({ url: oauthUrl });
});

// OAuth callback — backend handles the full exchange and DB save
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const userId = stateMap.get(state); // look up from map
  stateMap.delete(state); // clean up

  if (!code || !userId) {
    return res.redirect(
      `http://localhost:5173/dashboard?error=discord_auth_failed`,
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Fetch Discord user profile
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUser = userResponse.data;

    // Save or update in DB
    const existing = await findSocialAccountByPlatform(userId, "discord");

    if (existing) {
      await updateSocialAccountToken(
        existing.account_id,
        access_token,
        refresh_token,
        tokenExpiry,
      );
    } else {
      await createSocialAccount({
        userId,
        platform: "discord",
        accountHandle: discordUser.id,
        accountName: discordUser.username,
        profilePictureUrl: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        platformData: {
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
        },
      });
    }

    // Redirect frontend — no token in URL
    res.send(`
    <script>
        window.opener && window.opener.postMessage('discord-connected', '*');
        window.close();
    </script>`);
  } catch (error) {
    logger.error(
      "Discord OAuth error:" + (error.response?.data || error.message),
    );
    res.send(`
    <script>
        if (window.opener) {
        window.opener.postMessage('discord-error', '*');
        setTimeout(() => window.close(), 2000);
        } else {
        document.body.innerHTML = '<p>Authentication failed. You can close this window.</p>';
        }
    </script>`);
  }
});

// ─── User & Guild Data ────────────────────────────────────────────────────────

// Get connected Discord user info + guilds (used by /api/inbox)
router.get("/discordSummary", authenticateRequest, async (req, res) => {
  try {
    const userId = req.user.userId;
    const discordAccount = await findSocialAccountByPlatform(userId, "discord");

    if (!discordAccount) {
      return res.status(404).json({ error: "Discord not connected" });
    }

    const accessToken = await getValidAccessToken(discordAccount);

    // Fetch user and guilds in parallel
    const [userResponse, guildsResponse] = await Promise.all([
      axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const user = userResponse.data;
    const guilds = guildsResponse.data;

    // Derive account creation date from Discord snowflake ID
    const createdAt = new Date(
      Number(BigInt(user.id) >> 22n) + 1420070400000,
    ).toISOString();

    // Fetch member info (roles) for each guild in parallel
    const memberDetails = await Promise.allSettled(
      guilds.map((g) =>
        axios.get(`https://discord.com/api/users/@me/guilds/${g.id}/member`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ),
    );

    const enrichedGuilds = guilds.map((g, i) => {
      const memberResult = memberDetails[i];
      const member =
        memberResult.status === "fulfilled" ? memberResult.value.data : null;

      return {
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
        owner: g.owner,
        isVerified: g.features?.includes("VERIFIED") || false,
        isCommunity: g.features?.includes("COMMUNITY") || false,
        // Member-specific data — null if fetch failed (bot-only servers etc.)
        nickname: member?.nick || null,
        roles: member?.roles || [], // array of role IDs
        joinedAt: member?.joined_at || null,
      };
    });

    const webhookUrl =
      discordAccount.webhook_url || discordAccount.platform_data?.webhook_url;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        banner: user.banner || null,
        createdAt,
      },
      guilds: enrichedGuilds,
      stats: {
        totalServers: guilds.length,
        ownedServers: guilds.filter((g) => g.owner).length,
        verifiedServers: guilds.filter((g) => g.features?.includes("VERIFIED"))
          .length,
      },
      hasWebhook: !!webhookUrl,
    });
  } catch (error) {
    logger.error(
      "Error fetching Discord data:",
      error.response?.data || error.message,
    );
    if (error.response?.status === 400 || error.response?.status === 401) {
      return res.status(401).json({
        error: "Discord connection expired. Please reconnect.",
        needsReconnect: true,
      });
    }
    res.status(500).json({ error: "Failed to fetch Discord data" });
  }
});

// ─── Webhook ──────────────────────────────────────────────────────────────────

// Save webhook URL submitted by the user
router.post("/webhook", authenticateRequest, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { webhookUrl } = req.body;

    if (
      !webhookUrl ||
      !webhookUrl.startsWith("https://discord.com/api/webhooks/")
    ) {
      return res.status(400).json({ error: "Invalid Discord webhook URL" });
    }

    const discordAccount = await findSocialAccountByPlatform(userId, "discord");
    console.log("discordAccount for saving webhook: ", discordAccount);

    if (!discordAccount) {
      return res.status(404).json({ error: "Discord not connected" });
    }

    const updatedDiscordAccount = await updateDiscordWebhook(
      discordAccount.account_id,
      webhookUrl,
    );
    console.log("Updated Discord account: ", updatedDiscordAccount);

    if (!updatedDiscordAccount) {
      return res.status(500).json({ error: "Failed to update webhook" });
    }
    res.json({ message: "Webhook saved successfully" });
  } catch (error) {
    logger.error("Error saving webhook:", error);
    res.status(500).json({ error: "Failed to save webhook" });
  }
});

// Send a message to the user's saved webhook
router.post("/webhook/send", authenticateRequest, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content, embeds, username } = req.body;

    if (!content && (!embeds || embeds.length === 0)) {
      return res
        .status(400)
        .json({ error: "Message content or embeds required" });
    }

    const discordAccount = await findSocialAccountByPlatform(userId, "discord");
    console.log("discordAccount for sending webhook message: ", discordAccount);
    if (!discordAccount) {
      return res.status(404).json({ error: "Discord not connected" });
    }

    if (!discordAccount.webhook_url) {
      return res.status(400).json({
        error: "No webhook configured. Please add a webhook URL first.",
      });
    }

    await axios.post(discordAccount.webhook_url, {
      content: content || undefined,
      username: username || "Social Media Hub",
      embeds: embeds || undefined,
    });

    res.json({ message: "Message sent to Discord successfully" });
  } catch (error) {
    logger.error(
      "Error sending webhook message:",
      error.response?.data || error.message,
    );
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ─── Disconnect ───────────────────────────────────────────────────────────────

router.delete("/disconnect", authenticateRequest, async (req, res) => {
  try {
    const userId = req.user.userId;
    const discordAccount = await findSocialAccountByPlatform(userId, "discord");

    if (!discordAccount) {
      return res.status(404).json({ error: "Discord not connected" });
    }

    await updateSocialAccountToken(
      discordAccount.account_id,
      null,
      null,
      null,
      false,
    );
    res.json({ message: "Discord account disconnected" });
  } catch (error) {
    logger.error("Error disconnecting Discord:", error);
    res.status(500).json({ error: "Failed to disconnect Discord" });
  }
});

module.exports = router;
