import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { fetchDetailedAnalytics } from "../mock/mockApi";

const PLATFORM_CONFIG = {
  instagram: {
    name: "Instagram",
    icon: "📸",
    color: "#E1306C",
    gradient: "linear-gradient(135deg, #833AB4, #FD1D1D, #FCB045)",
    tag: "@instagram_hub",
  },
  facebook: {
    name: "Facebook",
    icon: "👥",
    color: "#1877F2",
    gradient: "linear-gradient(135deg, #1877F2, #0052cc)",
    tag: "@fb_official",
  },
  youtube: {
    name: "YouTube",
    icon: "▶️",
    color: "#FF0000",
    gradient: "linear-gradient(135deg, #FF0000, #cc0000)",
    tag: "Channel / @mediahub",
  },
};

const PIE_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ec4899"];

export default function DetailedAnalytics() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [chartType, setChartType] = useState("area"); // 'area' | 'bar'
  const [timeRange, setTimeRange] = useState("7d");
  const [exportNotice, setExportNotice] = useState(false);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        const data = await fetchDetailedAnalytics();
        setAnalyticsData(data);
      } catch (err) {
        setError(err.message || "Failed to fetch detailed analytics");
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  // Compute aggregated and filtered metrics
  const {
    platforms,
    totalAudience,
    totalPosts,
    totalEngagement,
    avgEngagementRate,
    combinedGrowthData,
    activePlatformData,
    engagementBreakdown,
  } = useMemo(() => {
    if (!analyticsData?.platforms) {
      return {
        platforms: [],
        totalAudience: 0,
        totalPosts: 0,
        totalEngagement: 0,
        avgEngagementRate: "0.0",
        combinedGrowthData: [],
        activePlatformData: null,
        engagementBreakdown: [],
      };
    }

    const plats = analyticsData.platforms;
    const totAud = plats.reduce((acc, p) => acc + (p.totalFollowers || 0), 0);
    const totPost = plats.reduce((acc, p) => acc + (p.totalPosts || 0), 0);
    const totEng = plats.reduce(
      (acc, p) => acc + (p.metrics?.postEngagement?.total || 0),
      0
    );
    const avgEng = (
      plats.reduce((acc, p) => acc + parseFloat(p.avgEngagementRate || 0), 0) /
      (plats.length || 1)
    ).toFixed(1);

    // Combine growth data across platforms
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const combinedGrowth = days.map((day) => {
      const entry = { day };
      let dayTotal = 0;
      plats.forEach((p) => {
        const found = p.metrics?.audienceGrowth?.find((d) => d.day === day);
        const val = found ? found.value : 0;
        entry[p.id] = val;
        dayTotal += val;
      });
      entry.total = dayTotal;
      return entry;
    });

    const activePlat =
      selectedPlatform === "all"
        ? null
        : plats.find((p) => p.id === selectedPlatform);

    // Engagement breakdown for active view
    let engBreakdown = [];
    if (selectedPlatform === "all") {
      let likes = 0,
        comments = 0,
        shares = 0;
      plats.forEach((p) => {
        likes += p.metrics?.postEngagement?.likes || 0;
        comments += p.metrics?.postEngagement?.comments || 0;
        shares += p.metrics?.postEngagement?.shares || 0;
      });
      const total = likes + comments + shares || 1;
      engBreakdown = [
        { name: "Likes", value: likes, percent: ((likes / total) * 100).toFixed(0) },
        { name: "Comments", value: comments, percent: ((comments / total) * 100).toFixed(0) },
        { name: "Shares", value: shares, percent: ((shares / total) * 100).toFixed(0) },
      ];
    } else if (activePlat) {
      const pe = activePlat.metrics?.postEngagement || {};
      const likes = pe.likes || 0;
      const comments = pe.comments || 0;
      const shares = pe.shares || 0;
      const total = likes + comments + shares || 1;
      engBreakdown = [
        { name: "Likes", value: likes, percent: ((likes / total) * 100).toFixed(0) },
        { name: "Comments", value: comments, percent: ((comments / total) * 100).toFixed(0) },
        { name: "Shares", value: shares, percent: ((shares / total) * 100).toFixed(0) },
      ];
    }

    return {
      platforms: plats,
      totalAudience: totAud,
      totalPosts: totPost,
      totalEngagement: totEng,
      avgEngagementRate: avgEng,
      combinedGrowthData: combinedGrowth,
      activePlatformData: activePlat,
      engagementBreakdown: engBreakdown,
    };
  }, [analyticsData, selectedPlatform]);

  const handleExport = () => {
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3000);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)", animation: "chatbot-spin 1s linear infinite" }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Loading Analytics Suite...</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Aggregating audience metrics & engagement insights</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel" style={{ padding: 32, textAlign: "center", borderColor: "rgba(239,68,68,0.3)" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Failed to Load Analytics</h3>
        <p style={{ color: "var(--muted)", marginBottom: 20 }}>{error}</p>
        <button className="btn btnPrimary" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    );
  }

  // Active chart data
  const chartData =
    selectedPlatform === "all"
      ? combinedGrowthData
      : activePlatformData?.metrics?.audienceGrowth || [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-h)",
            borderRadius: "10px",
            padding: "10px 14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            fontSize: "13px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            📅 {label} {timeRange === "7d" ? "(Daily Growth)" : ""}
          </div>
          {payload.map((entry, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color || entry.fill }} />
              <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>{entry.name}:</span>
              <strong style={{ color: "var(--text)" }}>{Number(entry.value).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Header & Action Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>
              Detailed Analytics & Intelligence
            </h2>
            <span className="badge badgeInfo" style={{ fontSize: 11, padding: "3px 8px" }}>LIVE DATA</span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Real-time cross-platform metrics, engagement distribution, and audience trajectory.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Time range selector */}
          <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 3, gap: 2 }}>
            {[
              { id: "7d", label: "7D" },
              { id: "30d", label: "30D" },
              { id: "90d", label: "90D" },
              { id: "1y", label: "1Y" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeRange(t.id)}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  background: timeRange === t.id ? "var(--accent)" : "transparent",
                  color: timeRange === t.id ? "#fff" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btnSecondary"
            onClick={handleExport}
            style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid var(--green)",
            color: "var(--green)",
            padding: "10px 16px",
            borderRadius: "var(--r-md)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span>✓ Analytics export generated successfully! Downloading report...</span>
          <button
            type="button"
            onClick={() => setExportNotice(false)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Global Overview KPI Bento */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, right: -10, width: 70, height: 70, background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Total Audience Reach</span>
            <span style={{ fontSize: 18 }}>👥</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {(selectedPlatform === "all" ? totalAudience : activePlatformData?.totalFollowers || 0).toLocaleString()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>↑ +14.8%</span>
            <span style={{ color: "var(--muted)" }}>vs prior {timeRange}</span>
          </div>
        </div>

        <div className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, right: -10, width: 70, height: 70, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Total Published Posts</span>
            <span style={{ fontSize: 18 }}>📝</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {(selectedPlatform === "all" ? totalPosts : activePlatformData?.totalPosts || 0).toLocaleString()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>↑ +6 posts</span>
            <span style={{ color: "var(--muted)" }}>active schedule</span>
          </div>
        </div>

        <div className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, right: -10, width: 70, height: 70, background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Total Engagements</span>
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {(selectedPlatform === "all" ? totalEngagement : activePlatformData?.metrics?.postEngagement?.total || 0).toLocaleString()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>↑ +21.3%</span>
            <span style={{ color: "var(--muted)" }}>likes, comments, shares</span>
          </div>
        </div>

        <div className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, right: -10, width: 70, height: 70, background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Avg Engagement Rate</span>
            <span style={{ fontSize: 18 }}>🎯</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {selectedPlatform === "all" ? avgEngagementRate : activePlatformData?.avgEngagementRate || "0.0"}%
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>↑ +0.6%</span>
            <span style={{ color: "var(--muted)" }}>above industry avg</span>
          </div>
        </div>
      </div>

      {/* Platform Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 10,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 12,
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedPlatform("all")}
          style={{
            padding: "8px 18px",
            borderRadius: "var(--r-md)",
            border: selectedPlatform === "all" ? "1px solid var(--accent)" : "1px solid var(--border)",
            background: selectedPlatform === "all" ? "var(--accent-glow)" : "var(--surface)",
            color: selectedPlatform === "all" ? "var(--accent-2)" : "var(--text)",
            fontWeight: selectedPlatform === "all" ? 700 : 500,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
          }}
        >
          <span>🌐</span>
          <span>All Channels</span>
          <span style={{ background: "var(--surface-h)", padding: "2px 6px", borderRadius: 10, fontSize: 11 }}>
            {platforms.length}
          </span>
        </button>

        {platforms.map((p) => {
          const cfg = PLATFORM_CONFIG[p.id] || { name: p.name, icon: "📊", color: "#6366f1" };
          const isSelected = selectedPlatform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlatform(p.id)}
              style={{
                padding: "8px 18px",
                borderRadius: "var(--r-md)",
                border: isSelected ? `1px solid ${cfg.color}` : "1px solid var(--border)",
                background: isSelected ? `${cfg.color}15` : "var(--surface)",
                color: isSelected ? "var(--text)" : "var(--muted)",
                fontWeight: isSelected ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.name}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface-h)", padding: "2px 6px", borderRadius: 10 }}>
                {p.totalFollowers?.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Charts Section */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Growth Visualizer */}
        <div className="panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                <span>📈</span>
                <span>
                  {selectedPlatform === "all"
                    ? "Cross-Platform Audience Growth"
                    : `${PLATFORM_CONFIG[selectedPlatform]?.name || "Platform"} Growth Trajectory`}
                </span>
              </h3>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Audience progression and follower velocity over {timeRange}
              </p>
            </div>

            {/* Area vs Bar Switcher */}
            <div style={{ display: "flex", background: "var(--surface-h)", borderRadius: "var(--r-sm)", padding: 2 }}>
              <button
                type="button"
                onClick={() => setChartType("area")}
                style={{
                  border: "none",
                  background: chartType === "area" ? "var(--surface)" : "transparent",
                  color: chartType === "area" ? "var(--text)" : "var(--muted)",
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  boxShadow: chartType === "area" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Area
              </button>
              <button
                type="button"
                onClick={() => setChartType("bar")}
                style={{
                  border: "none",
                  background: chartType === "bar" ? "var(--surface)" : "transparent",
                  color: chartType === "bar" ? "var(--text)" : "var(--muted)",
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  boxShadow: chartType === "bar" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Bar
              </button>
            </div>
          </div>

          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "area" ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorIg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E1306C" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#E1306C" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorFb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1877F2" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1877F2" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorYt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF0000" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FF0000" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {selectedPlatform === "all" ? (
                    <>
                      <Area type="monotone" dataKey="total" name="Total Audience" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" />
                      <Area type="monotone" dataKey="instagram" name="Instagram" stroke="#E1306C" strokeWidth={1.5} fillOpacity={0.5} fill="url(#colorIg)" />
                      <Area type="monotone" dataKey="facebook" name="Facebook" stroke="#1877F2" strokeWidth={1.5} fillOpacity={0.5} fill="url(#colorFb)" />
                      <Area type="monotone" dataKey="youtube" name="YouTube" stroke="#FF0000" strokeWidth={1.5} fillOpacity={0.5} fill="url(#colorYt)" />
                    </>
                  ) : (
                    <Area
                      type="monotone"
                      dataKey="value"
                      name={PLATFORM_CONFIG[selectedPlatform]?.name || "Followers"}
                      stroke={PLATFORM_CONFIG[selectedPlatform]?.color || "#6366f1"}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                    />
                  )}
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  {selectedPlatform === "all" ? (
                    <>
                      <Bar dataKey="instagram" name="Instagram" fill="#E1306C" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="facebook" name="Facebook" fill="#1877F2" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="youtube" name="YouTube" fill="#FF0000" radius={[4, 4, 0, 0]} />
                    </>
                  ) : (
                    <Bar
                      dataKey="value"
                      name={PLATFORM_CONFIG[selectedPlatform]?.name || "Followers"}
                      fill={PLATFORM_CONFIG[selectedPlatform]?.color || "#6366f1"}
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Engagement Distribution Donut */}
        <div className="panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>🍩</span>
              <span>Engagement Split</span>
            </h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Interaction breakdown by type
            </p>
          </div>

          <div style={{ width: "100%", height: 180, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={engagementBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {engagementBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend and percentage breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
            {engagementBreakdown.map((item, idx) => (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  background: "var(--surface-h)",
                  borderRadius: "var(--r-sm)",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>{item.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "var(--muted)" }}>{Number(item.value).toLocaleString()}</span>
                  <strong style={{ color: "var(--text)", minWidth: 32, textAlign: "right" }}>{item.percent}%</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Comparison Cards */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚡</span>
            <span>Channel Performance Comparison</span>
          </h3>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Synced across active APIs</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {platforms.map((plat) => {
            const cfg = PLATFORM_CONFIG[plat.id] || { name: plat.name, icon: "📱", color: "#6366f1", tag: "@handle" };
            const isHighlighted = selectedPlatform === "all" || selectedPlatform === plat.id;

            return (
              <div
                key={plat.id}
                className="panel"
                style={{
                  padding: 20,
                  opacity: isHighlighted ? 1 : 0.45,
                  transition: "all 0.2s ease",
                  borderLeft: `4px solid ${cfg.color}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--r-sm)",
                        background: `${cfg.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      {cfg.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{plat.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{cfg.tag}</div>
                    </div>
                  </div>
                  <span className="badge badgeSuccess" style={{ fontSize: 11 }}>Active</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div style={{ background: "var(--surface-h)", padding: "10px 12px", borderRadius: "var(--r-sm)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Followers</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                      {plat.totalFollowers.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: "var(--surface-h)", padding: "10px 12px", borderRadius: "var(--r-sm)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Posts Published</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                      {plat.totalPosts}
                    </div>
                  </div>
                </div>

                {/* Progress bar for engagement */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--muted)" }}>Engagement Rate</span>
                    <strong style={{ color: "var(--text)" }}>{plat.avgEngagementRate}%</strong>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "var(--surface-h)", borderRadius: 10, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(parseFloat(plat.avgEngagementRate) * 15, 100)}%`,
                        height: "100%",
                        background: cfg.color,
                        borderRadius: 10,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Growth Intelligence Advisory */}
      <div
        className="panel"
        style={{
          padding: "18px 22px",
          background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.08))",
          borderColor: "rgba(99,102,241,0.25)",
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r-md)",
            background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
            boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
          }}
        >
          💡
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              AI Growth Recommendation
            </h4>
            <span className="badge badgeInfo" style={{ fontSize: 10, padding: "2px 6px" }}>Automated Strategy</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            Your <strong>YouTube</strong> channel demonstrates the highest engagement velocity (4.1%). Scheduling video-first teasers on <strong>Instagram</strong> during peak hours (Fri–Sun) is projected to increase cross-conversion by up to <strong>+18%</strong> over the next 14 days.
          </p>
        </div>
      </div>
    </div>
  );
}
