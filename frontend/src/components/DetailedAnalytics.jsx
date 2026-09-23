import { useState, useEffect } from "react";
import {
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

const COLORS = ["#4F46E5", "#DC2626", "#F59E0B", "#16A34A"];

export default function DetailedAnalytics() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) {
    return (
      <div className="panel section">
        <h2 style={{ marginTop: 0 }}>Detailed Analytics</h2>
        <p className="subtitle" style={{ margin: 0 }}>
          Loading detailed analytics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel section">
        <h2 style={{ marginTop: 0 }}>Detailed Analytics</h2>
        <p className="error">{error}</p>
      </div>
    );
  }

  const DayTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="panel"
          style={{ padding: "8px 12px", fontSize: "13px" }}
        >
          <div>
            <strong>{label}</strong> ({payload[0]?.payload?.date})
          </div>
          <div>Followers: {payload[0]?.value?.toLocaleString()}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="section">
      <h2 className="title" style={{ marginTop: 0 }}>
        Detailed Analytics
      </h2>
      <p className="subtitle" style={{ margin: "6px 0 20px" }}>
        Visualizing data from connected apps.
      </p>

      {analyticsData &&
        analyticsData.platforms.map((platform) => (
          <div
            key={platform.id}
            className="panel section"
            style={{ marginBottom: "20px" }}
          >
            <h3 className="title" style={{ marginTop: 0, fontSize: "18px" }}>
              {platform.name} Overview
            </h3>

            <div className="grid2" style={{ marginBottom: "20px" }}>
              <div>
                <h4>Audience Growth (Last 7 Days)</h4>
                {platform.metrics.audienceGrowth.length === 0 ? (
                  <p className="subtitle">
                    No historical data yet. Check back after the next scheduler
                    run.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={platform.metrics.audienceGrowth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip content={<DayTooltip />} />
                      <Legend />
                      <Bar dataKey="value" name="Followers" fill="#4F46E5" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div>
                <h4>Post Engagement</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "Likes",
                          value: platform.metrics.postEngagement.likes,
                        },
                        {
                          name: "Comments",
                          value: platform.metrics.postEngagement.comments,
                        },
                        {
                          name: "Shares",
                          value: platform.metrics.postEngagement.shares,
                        },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {[
                        {
                          name: "Likes",
                          value: platform.metrics.postEngagement.likes,
                        },
                        {
                          name: "Comments",
                          value: platform.metrics.postEngagement.comments,
                        },
                        {
                          name: "Shares",
                          value: platform.metrics.postEngagement.shares,
                        },
                      ].map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "15px",
              }}
            >
              <div className="panel kpi" style={{ boxShadow: "none" }}>
                <div className="kpiLabel">Total Followers</div>
                <div className="kpiValue">
                  {platform.totalFollowers.toLocaleString()}
                </div>
              </div>
              <div className="panel kpi" style={{ boxShadow: "none" }}>
                <div className="kpiLabel">Total Posts</div>
                <div className="kpiValue">
                  {platform.totalPosts.toLocaleString()}
                </div>
              </div>
              <div className="panel kpi" style={{ boxShadow: "none" }}>
                <div className="kpiLabel">Avg. Engagement Rate</div>
                <div className="kpiValue">{platform.avgEngagementRate}%</div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
