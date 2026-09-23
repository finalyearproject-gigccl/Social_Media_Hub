import { useEffect, useState } from "react";
import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;

export default function Inbox() {
  const [inboxData, setInboxData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMsg, setWebhookMsg] = useState("");
  const [sendContent, setSendContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchInboxData(); // this is missing
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data === "discord-error") {
        setError("Discord authentication failed. Please try again.");
      } else if (event.data === "discord-connected") {
        fetchInboxData();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const getToken = () => localStorage.getItem("auth_token");

  const fetchInboxData = async () => {
    const token = getToken();
    if (!token) {
      setError("No auth token found");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/discord/discordSummary`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        // Not connected — treat as disconnected state
        setInboxData({ connected: false });
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch Discord data");

      const data = await response.json();
      setInboxData({ connected: true, ...data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectDiscord = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/auth/discord/auth/url`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (data.url) {
        const popup = window.open(
          data.url,
          "discord-oauth",
          "width=600,height=700",
        );

        // Poll for popup closure then re-fetch data
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            fetchInboxData(); // refresh to show connected state
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Failed to get auth URL:", err);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/auth/discord/webhook`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await response.json();
      if (response.ok) {
        setWebhookMsg("Webhook saved successfully!");
        setInboxData((prev) => ({ ...prev, hasWebhook: true }));
      } else {
        setWebhookMsg(data.error || "Failed to save webhook");
      }
    } catch (err) {
      setWebhookMsg("Failed to save webhook");
    }
  };

  const handleSendMessage = async () => {
    if (!sendContent.trim()) return;
    setSending(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/auth/discord/webhook/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: sendContent }),
      });
      const data = await response.json();
      if (response.ok) {
        setSendContent("");
        setWebhookMsg("Message sent to Discord!");
      } else {
        setWebhookMsg(data.error || "Failed to send message");
      }
    } catch (err) {
      setWebhookMsg("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="panel section">
        <p>Loading...</p>
      </div>
    );
  if (error)
    return (
      <div className="panel section">
        <p style={{ color: "#e74c3c" }}>Error: {error}</p>
      </div>
    );

  // Not connected
  if (!inboxData?.connected) {
    return (
      <div className="panel section">
        <h2 style={{ marginTop: 0 }}>Inbox</h2>
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>💬</div>
          <h3 style={{ marginBottom: "12px" }}>Connect Discord to use Inbox</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
            Link your Discord account to view your servers and send messages.
          </p>
          <button
            onClick={handleConnectDiscord}
            style={{
              padding: "12px 24px",
              backgroundColor: "#5865F2",
              color: "white",
              borderRadius: "6px",
              border: "none",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Connect Discord
          </button>
        </div>
      </div>
    );
  }

  const { user, guilds, hasWebhook, stats } = inboxData;

  return (
    <div className="panel section">
      <h2 style={{ marginTop: 0 }}>Inbox</h2>

      {/* Profile Hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "32px 20px",
          backgroundColor: "var(--bg-secondary)",
          borderRadius: "12px",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ position: "relative", marginBottom: "12px" }}>
          <img
            src={
              user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/0.png`
            }
            alt={user.username}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              border: "3px solid #5865F2",
            }}
          />
          {/* Online indicator dot */}
          <div
            style={{
              position: "absolute",
              bottom: "4px",
              right: "4px",
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: "#3ba55c",
              border: "2px solid var(--bg-secondary)",
            }}
          />
        </div>
        <div style={{ fontWeight: "700", fontSize: "20px" }}>
          {user.username}
          {user.discriminator !== "0" && (
            <span
              style={{
                color: "var(--text-secondary)",
                fontWeight: "400",
                fontSize: "16px",
              }}
            >
              #{user.discriminator}
            </span>
          )}
        </div>
        <div
          style={{
            color: "#5865F2",
            fontSize: "13px",
            fontWeight: "500",
            marginTop: "4px",
          }}
        >
          Discord Connected
        </div>
        {user.createdAt && (
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: "12px",
              marginTop: "6px",
            }}
          >
            Member since{" "}
            {new Date(user.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "28px",
        }}
      >
        {[
          {
            label: "Servers",
            value: stats?.totalServers || 0,
            color: "#5865F2",
          },
          { label: "Owned", value: stats?.ownedServers || 0, color: "#faa61a" },
          {
            label: "Verified",
            value: stats?.verifiedServers || 0,
            color: "#3ba55c",
          },
          {
            label: "Webhook",
            value: hasWebhook ? "✅" : "❌",
            color: "var(--text-primary)",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              padding: "16px 8px",
              backgroundColor: "var(--bg-secondary)",
              borderRadius: "10px",
              textAlign: "center",
              borderTop: `3px solid ${color}`,
            }}
          >
            <div style={{ fontSize: "22px", fontWeight: "700", color }}>
              {value}
            </div>
            <div
              style={{
                color: "var(--text-secondary)",
                fontSize: "12px",
                marginTop: "4px",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Servers Grid */}
      <h3 style={{ marginBottom: "16px" }}>Your Servers</h3>
      {guilds && guilds.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "28px",
          }}
        >
          {guilds.map((guild) => (
            <div
              key={guild.id}
              style={{
                padding: "16px",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "10px",
                border: guild.owner
                  ? "1px solid #5865F2"
                  : "1px solid transparent",
              }}
            >
              <img
                src={
                  guild.icon || `https://cdn.discordapp.com/embed/avatars/0.png`
                }
                alt={guild.name}
                style={{ width: "52px", height: "52px", borderRadius: "50%" }}
              />
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    fontWeight: "600",
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={guild.name}
                >
                  {guild.name}
                </div>
                {/* Badges */}
                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginTop: "6px",
                  }}
                >
                  {guild.owner && (
                    <span
                      style={{
                        fontSize: "10px",
                        backgroundColor: "#5865F2",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      Owner
                    </span>
                  )}
                  {guild.isVerified && (
                    <span
                      style={{
                        fontSize: "10px",
                        backgroundColor: "#3ba55c",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      ✓ Verified
                    </span>
                  )}
                  {guild.isCommunity && (
                    <span
                      style={{
                        fontSize: "10px",
                        backgroundColor: "#faa61a",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      Community
                    </span>
                  )}
                </div>
                {/* Meta info */}
                <div
                  style={{
                    marginTop: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {guild.nickname && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      aka {guild.nickname}
                    </div>
                  )}
                  {guild.joinedAt && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Joined {new Date(guild.joinedAt).toLocaleDateString()}
                    </div>
                  )}
                  {guild.roles?.length > 0 && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {guild.roles.length} role
                      {guild.roles.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary)" }}>No servers found.</p>
      )}

      {/* Webhook Setup */}
      <h3 style={{ marginBottom: "16px" }}>Webhook Setup</h3>
      <div
        style={{
          padding: "16px",
          backgroundColor: "var(--bg-secondary)",
          borderRadius: "10px",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "14px",
            marginBottom: "12px",
          }}
        >
          Go to your server's{" "}
          <strong>Settings → Integrations → Webhooks → New Webhook</strong>,
          copy the URL and paste it below.
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleSaveWebhook}
            style={{
              padding: "8px 20px",
              backgroundColor: "#5865F2",
              color: "white",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Save
          </button>
        </div>
        {webhookMsg && (
          <p
            style={{
              marginTop: "8px",
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            {webhookMsg}
          </p>
        )}
      </div>

      {/* Send Message */}
      {hasWebhook && (
        <>
          <h3 style={{ marginBottom: "16px" }}>Send Message to Discord</h3>
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-secondary)",
              borderRadius: "10px",
              marginBottom: "24px",
            }}
          >
            <textarea
              placeholder="Type a message to send to your Discord channel..."
              value={sendContent}
              onChange={(e) => setSendContent(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || !sendContent.trim()}
              style={{
                marginTop: "8px",
                padding: "8px 20px",
                backgroundColor: sending ? "#aaa" : "#5865F2",
                color: "white",
                borderRadius: "6px",
                border: "none",
                cursor: sending ? "not-allowed" : "pointer",
                fontWeight: "500",
              }}
            >
              {sending ? "Sending..." : "Send to Discord"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
