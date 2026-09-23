import { useEffect, useMemo, useState } from "react";
import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;

export default function Publish() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  async function fetchAccounts() {
    try {
      const response = await fetch(`${API_BASE}/api/accounts`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch accounts");

      const data = await response.json();
      const connected = (data.accounts || []).filter(
        (account) => account.is_connected !== false,
      );
      setAccounts(connected);
      setSelectedPlatforms(connected.map((account) => account.platform));
    } catch (err) {
      setError(err.message || "Could not load connected accounts");
    } finally {
      setLoading(false);
    }
  }

  const connectedPlatforms = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.platform))),
    [accounts],
  );

  const instagramRequiresImage =
    connectedPlatforms.includes("instagram") && !imageUrl.trim();
  const discordRequiresWebhook =
    connectedPlatforms.includes("discord") &&
    !accounts.some((account) => {
      if (account.platform !== "discord") return false;
      return Boolean(account.webhook_url || account.platform_data?.webhook_url);
    });

  useEffect(() => {
    if (instagramRequiresImage && selectedPlatforms.includes("instagram")) {
      setSelectedPlatforms((current) =>
        current.filter((platform) => platform !== "instagram"),
      );
    }
  }, [instagramRequiresImage, selectedPlatforms]);

  useEffect(() => {
    if (discordRequiresWebhook && selectedPlatforms.includes("discord")) {
      setSelectedPlatforms((current) =>
        current.filter((platform) => platform !== "discord"),
      );
    }
  }, [discordRequiresWebhook, selectedPlatforms]);

  const getPlatformButtonStyle = (platform, isSelected, disabled) => {
    const platformColors = {
      instagram: {
        background: disabled ? "#f8d7e0" : isSelected ? "#E4405F" : "#fff5f7",
        border: "#E4405F",
        color: disabled ? "#8b4b5c" : isSelected ? "#fff" : "#E4405F",
      },
      facebook: {
        background: disabled ? "#dcecff" : isSelected ? "#1877F2" : "#f5f9ff",
        border: "#1877F2",
        color: disabled ? "#5b6f87" : isSelected ? "#fff" : "#1877F2",
      },
      youtube: {
        background: disabled ? "#ffe1e1" : isSelected ? "#FF0000" : "#fff7f7",
        border: "#FF0000",
        color: disabled ? "#8a4d4d" : isSelected ? "#fff" : "#FF0000",
      },
      discord: {
        background: disabled ? "#e7e8ff" : isSelected ? "#5865F2" : "#f7f8ff",
        border: "#5865F2",
        color: disabled ? "#5d628d" : isSelected ? "#fff" : "#5865F2",
      },
    };

    const styles = platformColors[platform] || {
      background: disabled ? "#f3f4f6" : isSelected ? "#6b7280" : "#ffffff",
      border: "#6b7280",
      color: disabled ? "#6b7280" : isSelected ? "#fff" : "#6b7280",
    };

    return {
      textTransform: "capitalize",
      border: `1px solid ${styles.border}`,
      backgroundColor: styles.background,
      color: styles.color,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.75 : 1,
      fontWeight: 600,
    };
  };

  const togglePlatform = (platform) => {
    if (
      (platform === "instagram" && instagramRequiresImage) ||
      (platform === "discord" && discordRequiresWebhook)
    ) {
      return;
    }

    setSelectedPlatforms((current) => {
      if (current.includes(platform)) {
        return current.filter((item) => item !== platform);
      }
      return [...current, platform];
    });
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      setError("Please enter some content first.");
      return;
    }

    setPublishing(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/publish`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content,
          imageUrl: imageUrl.trim() || null,
          platforms: selectedPlatforms,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Publish request failed");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Publish request failed");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="panel section">
        <p>Loading connected accounts...</p>
      </div>
    );
  }

  return (
    <div className="panel section">
      <h2 style={{ marginTop: 0 }}>Publish</h2>
      <p className="subtitle" style={{ marginTop: -6 }}>
        Send one post to every connected platform you select.
      </p>

      {error ? <div className="error">{error}</div> : null}

      <div style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Post content</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            placeholder="Write your post here..."
            style={{ width: "100%", borderRadius: 8, padding: 12 }}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>
            Image URL (required for Instagram)
          </span>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://example.com/image.jpg"
            style={{ width: "100%", borderRadius: 8, padding: 10 }}
          />
          {instagramRequiresImage && (
            <span style={{ fontSize: 13, color: "#E4405F" }}>
              Add an image URL to enable Instagram publishing.
            </span>
          )}
        </label>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Choose platforms
          </div>
          {connectedPlatforms.length === 0 ? (
            <p className="subtitle">No connected platforms found yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {connectedPlatforms.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform);
                  const disabled =
                    (platform === "instagram" && instagramRequiresImage) ||
                    (platform === "discord" && discordRequiresWebhook);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={`btn ${isSelected ? "btnPrimary" : ""}`}
                      style={getPlatformButtonStyle(
                        platform,
                        isSelected,
                        disabled,
                      )}
                      disabled={disabled}
                    >
                      {isSelected ? "✓" : "○"} {platform}
                    </button>
                  );
                })}
              </div>
              {discordRequiresWebhook && (
                <span style={{ fontSize: 13, color: "#5865F2" }}>
                  Add a Discord webhook in Inbox to enable Discord publishing.
                </span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btnPrimary"
          onClick={handlePublish}
          disabled={publishing || selectedPlatforms.length === 0}
        >
          {publishing ? "Publishing..." : "Publish Now"}
        </button>

        {result ? (
          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {result.message}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {result.results.map((item, index) => (
                <li key={`${item.platform}-${index}`}>
                  <strong>{item.platform}</strong>: {item.status}
                  {item.error ? ` — ${item.error}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
