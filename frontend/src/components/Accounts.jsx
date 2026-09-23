import { useEffect, useState } from "react";
import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/accounts`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        data.accounts = data.accounts.filter(
          (acc) => acc.is_connected === true,
        );
        setAccounts(data.accounts);
      } else {
        setError("Failed to load accounts");
      }
    } catch (err) {
      setError("Error loading accounts");
    } finally {
      setLoading(false);
    }
  };

  const metaConnected = accounts.some(
    (acc) => acc.platform === "instagram" || acc.platform === "facebook",
  );
  const youtubeConnected = accounts.some((acc) => acc.platform === "youtube");

  const handleConnect = async (platform) => {
    try {
      const token = localStorage.getItem("auth_token");

      if (platform === "meta") {
        // Single Meta button connects both Facebook + Instagram
        const popup = window.open(
          `${API_BASE}/auth/meta?token=${token}`,
          `meta-oauth`,
          "width=600,height=600",
        );
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            fetchAccounts(); // Refresh accounts after connect
          }
        }, 1000);
      } else if (platform === "youtube") {
        // Open YouTube OAuth in a popup
        const popup = window.open(
          `${API_BASE}/auth/youtube?token=${token}`,
          `youtube-oauth`,
          "width=600,height=600",
        );
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            fetchAccounts(); // Refresh accounts after connect
          }
        }, 1000);
      }
    } catch (e) {
      console.error(`${platform} connect error:`, e);
    }
  };

  const handleDisconnect = async (account) => {
    try {
      // Use platform-specific endpoints to properly revoke tokens
      let url;
      if (account.platform === "youtube") {
        url = `${API_BASE}/auth/youtube/disconnect`;
      } else if (
        account.platform === "instagram" ||
        account.platform === "facebook"
      ) {
        url = `${API_BASE}/auth/meta/disconnect`;
      } else {
        url = `${API_BASE}/api/accounts/${account.account_id}`;
      }

      const response = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // For Meta, remove both instagram and facebook from UI
        if (
          account.platform === "instagram" ||
          account.platform === "facebook"
        ) {
          setAccounts(
            accounts.filter(
              (acc) =>
                acc.platform !== "instagram" && acc.platform !== "facebook",
            ),
          );
        } else {
          setAccounts(
            accounts.filter((acc) => acc.account_id !== account.account_id),
          );
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to disconnect account");
      }
    } catch (err) {
      setError("Error disconnecting account");
    }
  };

  if (loading) return <p>Loading accounts...</p>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <div className="toolbar">
        <h2 className="title" style={{ margin: 0 }}>
          Connected Accounts
        </h2>
        <div className="row">
          {!metaConnected && (
            <button
              className="btn btnPrimary"
              onClick={() => handleConnect("meta")}
              type="button"
            >
              Connect Meta (Facebook + Instagram)
            </button>
          )}
          {!youtubeConnected && (
            <button
              className="btn btnPrimary"
              onClick={() => handleConnect("youtube")}
              type="button"
            >
              Connect YouTube
            </button>
          )}
          {metaConnected && youtubeConnected && (
            <span className="badge badgeOk">All platforms connected</span>
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
          <p>
            No accounts connected yet. Click the button above to connect your
            Meta account!
          </p>
        </div>
      ) : (
        <div className="account-list" style={{ display: "grid", gap: "1rem" }}>
          {accounts.map((acc) => (
            <div key={acc.account_id} className="panel account-item">
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span className="badgeAcc">{acc.platform.toUpperCase()}</span>
                  {acc.account_name && <span> {acc.account_name}</span>}
                </div>
                <button className="btn" onClick={() => handleDisconnect(acc)}>
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
