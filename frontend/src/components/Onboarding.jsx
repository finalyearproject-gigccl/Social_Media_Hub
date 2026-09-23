import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;

export default function Onboarding({ onConnectPlatform, theme }) {
  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const handleConnect = async (platform) => {
    try {
      const token = localStorage.getItem("auth_token");

      if (platform === "meta") {
        // Open Meta OAuth in a popup (connects both Facebook + Instagram)
        const popup = window.open(
          `${API_BASE}/auth/meta?token=${token}`,
          "meta-oauth",
          "width=600,height=600",
        );

        // Poll for popup closure
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Refresh or notify parent
            window.location.reload(); // Simple way to refresh after connect
          }
        }, 1000);
      } else if (platform === "youtube") {
        // Open YouTube OAuth in a popup
        const popup = window.open(
          `${API_BASE}/auth/youtube?token=${token}`,
          "youtube-oauth",
          "width=600,height=600",
        );

        // Poll for popup closure
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.location.reload();
          }
        }, 1000);
      }
    } catch (e) {
      console.error(`${platform} connect error:`, e);
    }
  };

  return (
    <div className="onboarding">
      <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
        <h2 style={{ marginTop: 0 }}>
          Welcome to Your Social Analytics Dashboard
        </h2>
        <p style={{ margin: "1rem 0" }}>
          Connect your social media accounts to unlock insights like engagement
          rates, follower growth, and post analytics.
        </p>
        <div
          className="connect-options"
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn btnPrimary"
            onClick={() => handleConnect("meta")}
            type="button"
          >
            Connect Meta (Facebook + Instagram)
          </button>
          <button
            className="btn btnPrimary"
            onClick={() => handleConnect("youtube")}
            type="button"
          >
            Connect YouTube
          </button>
        </div>
        <p
          style={{
            margin: "1rem 0",
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
          }}
        >
          More platforms (Twitter, LinkedIn) coming soon!
        </p>
      </div>
    </div>
  );
}
