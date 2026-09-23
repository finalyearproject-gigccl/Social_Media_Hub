import { useEffect, useMemo, useState } from "react";
import Onboarding from "./Onboarding.jsx";
import InterestsSelection from "./InterestsSelection.jsx";
import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;
const LS_IG_CONNECTED = "mock_instagram_connected";

const mockPosts = [
  {
    id: 1,
    platform: "linkedin",
    content:
      "Excited to share our latest insights on building scalable web applications. 🚀",
    likes: 342,
    comments: 28,
    impressions: 5420,
    timestamp: "2 hours ago",
  },
  {
    id: 2,
    platform: "instagram",
    content: "Behind the scenes at our design sprint this week. ✨",
    likes: 1247,
    comments: 64,
    impressions: 12350,
    timestamp: "5 hours ago",
  },
  {
    id: 3,
    platform: "twitter",
    content:
      "Key takeaway: consistency beats intensity. What's your best growth tip?",
    likes: 589,
    comments: 45,
    impressions: 7820,
    timestamp: "1 day ago",
  },
];

function useCountUp(target, duration = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!target) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountSummary, setAccountSummary] = useState(null);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [showInterestsSelection, setShowInterestsSelection] = useState(false);
  const [userInterests, setUserInterests] = useState([]);

  const igConnected = accounts.some((acc) => acc.platform === "instagram");
  const fbConnected = accounts.some((acc) => acc.platform === "facebook");
  const ytConnected = accounts.some((acc) => acc.platform === "youtube");
  const hasMetaConnection = igConnected || fbConnected;
  const [youtubeChannel, setYoutubeChannel] = useState(null);
  // Get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  useEffect(() => {
    fetchAccounts();
    checkUserInterests();
  }, []);

  async function fetchYoutubeChannel() {
    try {
      const response = await fetch(`${API_BASE}/auth/youtube/channelSummary`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setYoutubeChannel(data);
        return data; // return instead of triggering loadAccountSummary
      }
    } catch (err) {
      console.error("Error fetching YouTube channel:", err);
    }
    return null;
  }

  async function checkUserInterests() {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserInterests(user.interests || []);

        // If no interests set, show interests selection
        if (!user.interests || user.interests.length === 0) {
          setShowInterestsSelection(true);
        } else {
          fetchTrendingTopics();
        }
      }
    } catch (err) {
      console.error("Error checking user interests:", err);
    }
  }

  async function fetchTrendingTopics() {
    setTrendingLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/trending`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setTrendingTopics(data.topics || []);
      } else {
        // Fallback to mock posts if API fails
        setTrendingTopics(mockPosts);
      }
    } catch (err) {
      console.error("Error fetching trending topics:", err);
      setTrendingTopics(mockPosts);
    } finally {
      setTrendingLoading(false);
    }
  }

  const handleInterestsComplete = async (interests) => {
    setUserInterests(interests);
    setShowInterestsSelection(false);

    // Only save to backend if interests were actually selected (not skipped)
    if (interests.length > 0) {
      try {
        const token = localStorage.getItem("auth_token");
        await fetch(`${API_BASE}/api/auth/interests`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ interests }),
        });

        // Update localStorage with new interests
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const user = JSON.parse(storedUser);
          user.interests = interests;
          localStorage.setItem("user", JSON.stringify(user));
        }

        fetchTrendingTopics();
      } catch (err) {
        console.error("Error saving interests:", err);
      }
    }
  };

  async function fetchAccounts() {
    try {
      const response = await fetch(`${API_BASE}/api/accounts`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setError("Failed to load accounts");
        return;
      }

      const data = await response.json();
      const connectedAccounts = data.accounts.filter(
        (acc) => acc.is_connected === true,
      );
      setAccounts(connectedAccounts);

      const hasMeta = connectedAccounts.some(
        (acc) => acc.platform === "instagram" || acc.platform === "facebook",
      );
      const hasYt = connectedAccounts.some((acc) => acc.platform === "youtube");

      // Fetch Meta and YouTube in parallel, wait for both
      const [_, ytData] = await Promise.all([
        hasMeta ? Promise.resolve() : Promise.resolve(), // Meta is fetched inside loadAccountSummary
        hasYt ? fetchYoutubeChannel() : Promise.resolve(null),
      ]);

      // Call loadAccountSummary exactly once with complete data
      if (hasMeta || hasYt) {
        await loadAccountSummary(ytData ?? null, connectedAccounts);
      }
    } catch (err) {
      setError("Error loading accounts");
      console.error("Error checking accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountSummary(
    ytData = youtubeChannel,
    currentAccounts = accounts,
  ) {
    try {
      const token = localStorage.getItem("auth_token");

      // Now uses the passed-in accounts instead of stale state
      const hasMeta = currentAccounts.some(
        (acc) => acc.platform === "instagram" || acc.platform === "facebook",
      );
      const isYtConnected = currentAccounts.some(
        (acc) => acc.platform === "youtube",
      );

      const ytPlatform =
        isYtConnected && ytData
          ? {
              platform: "youtube",
              connected: true,
              profile: {
                name: ytData.channel?.channelName,
                followers_count: ytData.statistics?.subscribers || 0,
              },
              recentPosts: ytData.recentPosts || [],
            }
          : null;

      if (hasMeta) {
        const response = await fetch(
          `${API_BASE}/auth/meta/account-summary?token=${token}`,
          { headers: getAuthHeaders() },
        );

        if (response.ok) {
          const data = await response.json();

          if (ytPlatform) {
            data.platforms = [...(data.platforms || []), ytPlatform];
            const ytEngagement = (ytData.recentPosts || []).reduce(
              (total, post) => {
                return (
                  total +
                  (post.statistics?.likes || 0) +
                  (post.statistics?.comments || 0)
                );
              },
              0,
            );
            data.combined = {
              ...data.combined,
              totalFollowers:
                (data.combined?.totalFollowers || 0) +
                (ytData.statistics?.subscribers || 0),
              totalReach:
                (data.combined?.totalReach || 0) +
                (ytData.statistics?.totalViews || 0),
              totalEngagement:
                (data.combined?.totalEngagement || 0) + ytEngagement,
              totalPosts:
                (data.combined?.totalPosts || 0) +
                (ytData.statistics?.videos || 0),
            };
          }

          setAccountSummary(data);
        } else {
          const err = await response.json();
          setError(err.error || "Failed to load account summary");
        }
      } else if (ytPlatform) {
        setAccountSummary({
          combined: {
            totalFollowers: ytData.statistics?.subscribers || 0,
            totalReach: ytData.statistics?.totalViews || 0,
            totalEngagement: 0,
            totalPosts: ytData.recentPosts?.length || 0,
          },
          platforms: [ytPlatform],
        });
      }
    } catch (error) {
      setError("Failed to load account summary");
      console.error("Error loading account summary:", error);
    }
  }

  async function handleConnectMeta() {
    setError("");
    try {
      const token = localStorage.getItem("auth_token");
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
          // Check connection after popup closes
          fetchAccounts();
        }
      }, 1000);
    } catch (e) {
      setError("Instagram connect failed");
      console.error("Instagram connect error:", e);
    }
  }

  async function handleDisconnectMeta() {
    try {
      const response = await fetch(`${API_BASE}/auth/meta/disconnect`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const updatedAccounts = accounts.filter(
          (acc) => acc.platform !== "instagram" && acc.platform !== "facebook",
        );
        setAccounts(updatedAccounts);
        setError("");

        if (ytConnected && youtubeChannel) {
          // Rebuild summary with only YouTube — Meta platforms will be excluded
          // because updatedAccounts has no Meta, so hasMeta will be false in loadAccountSummary
          setAccountSummary({
            combined: {
              totalFollowers: youtubeChannel.statistics?.subscribers || 0,
              totalReach: youtubeChannel.statistics?.totalViews || 0,
              totalEngagement:
                youtubeChannel.recentPosts?.reduce(
                  (t, p) =>
                    t +
                    (p.statistics?.likes || 0) +
                    (p.statistics?.comments || 0),
                  0,
                ) || 0,
              totalPosts: youtubeChannel.statistics?.videos || 0,
            },
            platforms: [
              {
                platform: "youtube",
                connected: true,
                profile: {
                  name: youtubeChannel.channel?.channelName,
                  followers_count: youtubeChannel.statistics?.subscribers || 0,
                },
                recentPosts: youtubeChannel.recentPosts || [],
              },
            ],
          });
        } else {
          // No platforms left
          setAccountSummary(null);
        }
      } else {
        const data = await response.json();
        setError(data.error || "Failed to disconnect accounts");
      }
    } catch (e) {
      setError("Failed to disconnect accounts");
      console.error("Disconnect error:", e);
    }
  }

  async function handleConnectYoutube() {
    setError("");
    try {
      const token = localStorage.getItem("auth_token");
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
          // Check connection after popup closes
          fetchAccounts();
        }
      }, 1000);
    } catch (e) {
      setError("YouTube connect failed");
      console.error("YouTube connect error:", e);
    }
  }

  async function handleDisconnectYoutube() {
    try {
      const response = await fetch(`${API_BASE}/auth/youtube/disconnect`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const updatedAccounts = accounts.filter(
          (acc) => acc.platform !== "youtube",
        );
        setAccounts(updatedAccounts);
        setYoutubeChannel(null);
        setError("");

        // Rebuild summary without YouTube
        const hasMeta = updatedAccounts.some(
          (acc) => acc.platform === "instagram" || acc.platform === "facebook",
        );

        if (hasMeta) {
          // Reload Meta summary without YouTube appended
          loadAccountSummary(null, updatedAccounts);
        } else {
          // No platforms left — clear everything
          setAccountSummary(null);
        }
      } else {
        const data = await response.json();
        setError(data.error || "Failed to disconnect YouTube");
      }
    } catch (e) {
      setError("Failed to disconnect YouTube");
      console.error("YouTube disconnect error:", e);
    }
  }

  // Combined metrics from account summary
  const combinedMetrics = accountSummary?.combined || {
    totalFollowers: 0,
    totalReach: 0,
    totalEngagement: 0,
    totalPosts: 0,
  };
  const animatedFollowers = useCountUp(combinedMetrics.totalFollowers);
  const animatedReach = useCountUp(combinedMetrics.totalReach);
  const animatedEngagement = useCountUp(combinedMetrics.totalEngagement);
  const animatedPosts = useCountUp(combinedMetrics.totalPosts);

  const totalEngagement = useMemo(
    () => combinedMetrics.totalEngagement,
    [combinedMetrics.totalEngagement],
  );
  const totalReach = useMemo(
    () => combinedMetrics.totalReach,
    [combinedMetrics.totalReach],
  );
  const engagementRate = useMemo(() => {
    if (!totalReach) return "0.00";
    return ((totalEngagement / totalReach) * 100).toFixed(2);
  }, [totalEngagement, totalReach]);
  const youtubeEngagement = useMemo(() => {
    if (!youtubeChannel?.recentPosts) return 0;
    return youtubeChannel.recentPosts.reduce((total, post) => {
      return (
        total + (post.statistics?.likes || 0) + (post.statistics?.comments || 0)
      );
    }, 0);
  }, [youtubeChannel]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--muted)", gap: 10, fontSize: 15 }}>
      <span style={{ animation: "chatbot-spin 1s linear infinite", display: "inline-block" }}>⚙️</span> Loading your dashboard...
    </div>
  );
  if (error) return <div className="error">{error}</div>;

  if (accounts.length === 0) {
    return <Onboarding onConnectPlatform={handleConnectMeta} />;
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 className="title">Dashboard</h2>
          <p className="subtitle" style={{ margin: 0 }}>Your social media overview</p>
        </div>

        <div className="toolbar-right">
          {igConnected && <span className="badge badgeOk">📸 Instagram</span>}
          {fbConnected && <span className="badge badgeOk">📘 Facebook</span>}
          {ytConnected && <span className="badge badgeOk">▶️ YouTube</span>}
          {!hasMetaConnection && !ytConnected && (
            <span className="badge">No platforms connected</span>
          )}

          {hasMetaConnection ? (
            <button className="btn" onClick={handleDisconnectMeta} type="button">
              Disconnect Meta
            </button>
          ) : (
            <button className="btn btnPrimary" onClick={handleConnectMeta} type="button">
              + Connect Meta
            </button>
          )}
          {ytConnected ? (
            <button className="btn" onClick={handleDisconnectYoutube} type="button">
              Disconnect YouTube
            </button>
          ) : (
            <button className="btn btnPrimary" onClick={handleConnectYoutube} type="button">
              + Connect YouTube
            </button>
          )}
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {/* Combined KPIs */}
      <div className="kpis">
        <div className="panel kpi">
          <div className="kpiIcon">👥</div>
          <div className="kpiLabel">Total Followers</div>
          <div className="kpiValue">{animatedFollowers.toLocaleString()}</div>
          <div className="kpiTrend">↑ All platforms</div>
        </div>
        <div className="panel kpi">
          <div className="kpiIcon">👁️</div>
          <div className="kpiLabel">Total Reach</div>
          <div className="kpiValue">{animatedReach.toLocaleString()}</div>
          <div className="kpiTrend">↑ Combined views</div>
        </div>
        <div className="panel kpi">
          <div className="kpiIcon">💬</div>
          <div className="kpiLabel">Total Engagement</div>
          <div className="kpiValue">{animatedEngagement.toLocaleString()}</div>
          <div className="kpiTrend">Likes + Comments</div>
        </div>
        <div className="panel kpi">
          <div className="kpiIcon">📝</div>
          <div className="kpiLabel">Total Posts</div>
          <div className="kpiValue">{animatedPosts.toLocaleString()}</div>
          <div className="kpiTrend">Across all platforms</div>
        </div>
      </div>

      <div className="grid2">
        {/* Platform breakdown */}
        <div className="panel section">
          <h3 className="section-title">🔗 Connected Platforms</h3>
          {accountSummary?.platforms?.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {accountSummary.platforms.map((platform) => (
                <div
                  key={platform.platform}
                  className="panel"
                  style={{ boxShadow: "none", padding: "12px" }}
                >
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="badge">
                      {platform.platform === "instagram" ? "📸" : "📘"}{" "}
                      {platform.platform.charAt(0).toUpperCase() +
                        platform.platform.slice(1)}
                    </span>
                    <span
                      className={`badge ${
                        platform.connected ? "badgeOk" : "badgeError"
                      }`}
                    >
                      {platform.connected ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  {platform.connected && platform.profile && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        className="row"
                        style={{ justifyContent: "space-between" }}
                      >
                        <span>
                          {platform.profile.username || platform.profile.name}
                        </span>
                        <span>
                          {platform.profile.followers_count?.toLocaleString() ||
                            platform.profile.followers_count ||
                            platform.profile.fan_count?.toLocaleString() ||
                            0}{" "}
                          {platform.platform === "youtube"
                            ? "Subscribers"
                            : "Followers"}
                        </span>
                      </div>
                      {platform.recentPosts?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div className="kpiLabel" style={{ marginBottom: 6 }}>
                            Recent posts
                          </div>
                          {platform.recentPosts.slice(0, 5).map((m, idx) => (
                            <div
                              key={m.id || m.videoId || idx}
                              className="panel post"
                              style={{
                                boxShadow: "none",
                                padding: "8px",
                                display: "flex",
                                gap: "10px",
                                alignItems: "flex-start",
                              }}
                            >
                              {/* Post thumbnail - handle both Meta and YouTube */}
                              {(m.media_url ||
                                m.full_picture ||
                                m.thumbnail) && (
                                <img
                                  src={
                                    m.media_url || m.full_picture || m.thumbnail
                                  }
                                  alt="Post thumbnail"
                                  style={{
                                    width: "60px",
                                    height: "60px",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="postMeta">
                                  <span className="postPlatform">
                                    {m.media_type ||
                                      (platform.platform === "facebook"
                                        ? "fb post"
                                        : platform.platform === "youtube"
                                          ? "📺 YouTube"
                                          : "post")}
                                  </span>
                                  <span className="postTime">
                                    {new Date(
                                      m.timestamp ||
                                        m.created_time ||
                                        m.publishedAt,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                                <p
                                  className="postText"
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    margin: 0,
                                    fontSize: "13px",
                                  }}
                                >
                                  {m.caption ||
                                    m.message ||
                                    m.title ||
                                    "No caption"}
                                </p>
                                {/* YouTube-specific stats */}
                                {platform.platform === "youtube" &&
                                  m.statistics && (
                                    <div
                                      style={{
                                        marginTop: 4,
                                        fontSize: "12px",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {m.statistics.views?.toLocaleString()}{" "}
                                      views •{" "}
                                      {m.statistics.likes?.toLocaleString()}{" "}
                                      likes
                                    </div>
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="subtitle" style={{ margin: 0 }}>
              Loading platform data...
            </p>
          )}
        </div>

        <div className="panel section">
          <h3 className="section-title">🔥 Trending Topics</h3>
          {showInterestsSelection ? (
            <InterestsSelection
              onComplete={handleInterestsComplete}
              showSkip={false}
            />
          ) : trendingLoading ? (
            <p className="subtitle">Loading trending topics...</p>
          ) : trendingTopics.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <p className="subtitle">No trending topics available.</p>
              <p
                style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}
              >
                Select your interests to see personalized trending content.
              </p>
              <button
                className="btn btnPrimary"
                onClick={() => setShowInterestsSelection(true)}
                type="button"
              >
                Select Interests
              </button>
            </div>
          ) : (
            <div className="postList">
              {trendingTopics.map((topic, index) => (
                <div
                  key={index}
                  className="panel post"
                  style={{ boxShadow: "none" }}
                >
                  <div className="postMeta">
                    <span className="postPlatform">
                      {topic.source || "News"}
                    </span>
                    {topic.publishedAt && (
                      <span className="postTime">
                        {new Date(topic.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="postText">{topic.title}</p>
                  {topic.description && (
                    <p
                      style={{
                        margin: "4px 0 8px 0",
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {topic.description.length > 150
                        ? topic.description.substring(0, 150) + "..."
                        : topic.description}
                    </p>
                  )}
                  {topic.image && (
                    <img
                      src={topic.image}
                      alt={topic.title}
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                      style={{
                        width: "100%",
                        maxHeight: "150px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        marginTop: "8px",
                      }}
                    />
                  )}
                  {topic.url && topic.url !== "#" && (
                    <a
                      href={topic.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "13px", color: "var(--primary)" }}
                    >
                      Read more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
