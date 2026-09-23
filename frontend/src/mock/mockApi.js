import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Get auth token from localStorage
function getAuthToken() {
  return localStorage.getItem("auth_token");
}

// Fetch with auth header
async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchInstagramAnalytics() {
  // Try to fetch real data first
  try {
    const response = await fetch(`${API_BASE}/api/analytics`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    // Find Instagram analytics
    const instagram = data.platforms?.find((p) => p.id === "instagram");
    if (instagram) {
      return {
        id: instagram.id,
        username: instagram.name,
        account_type: "BUSINESS",
        media_count: instagram.totalPosts,
        recent_media: [],
      };
    }
  } catch (err) {
    console.warn(
      "Failed to fetch real Instagram analytics, using mock:",
      err.message,
    );
  }

  // Fallback to mock data
  await sleep(550);

  return {
    id: "17841400000000000",
    username: "demo_creator",
    account_type: "PERSONAL",
    media_count: 128,
    recent_media: [
      {
        id: "m1",
        caption: "Shipping features and learning every day.",
        media_type: "IMAGE",
        permalink: "#",
        timestamp: "2 hours ago",
      },
      {
        id: "m2",
        caption: "Analytics dashboard progress update.",
        media_type: "CAROUSEL_ALBUM",
        permalink: "#",
        timestamp: "1 day ago",
      },
      {
        id: "m3",
        caption: "New post idea: best time to publish.",
        media_type: "VIDEO",
        permalink: "#",
        timestamp: "3 days ago",
      },
    ],
  };
}

export async function fetchDetailedAnalytics() {
  // Try to fetch real data first
  try {
    const data = await fetchWithAuth(`${API_BASE}/api/analytics`);
    if (data.platforms && data.platforms.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn("Failed to fetch real analytics, using mock:", err.message);
  }

  // Fallback to mock data
  await sleep(700);

  return {
    platforms: [
      {
        id: "instagram",
        name: "Instagram",
        totalFollowers: 154,
        totalPosts: 13,
        avgEngagementRate: "3.2",
        metrics: {
          audienceGrowth: [
            { day: "Mon", value: 100 },
            { day: "Tue", value: 120 },
            { day: "Wed", value: 150 },
            { day: "Thu", value: 130 },
            { day: "Fri", value: 180 },
            { day: "Sat", value: 200 },
            { day: "Sun", value: 190 },
          ],
          postEngagement: {
            likes: 700,
            comments: 200,
            shares: 100,
            total: 1000,
          },
        },
      },
      {
        id: "facebook",
        name: "Facebook",
        totalFollowers: 7,
        totalPosts: 2,
        avgEngagementRate: "2.5",
        metrics: {
          audienceGrowth: [
            { day: "Mon", value: 80 },
            { day: "Tue", value: 90 },
            { day: "Wed", value: 110 },
            { day: "Thu", value: 100 },
            { day: "Fri", value: 130 },
            { day: "Sat", value: 150 },
            { day: "Sun", value: 140 },
          ],
          postEngagement: { likes: 500, comments: 150, shares: 80, total: 730 },
        },
      },
      {
        id: "youtube",
        name: "YouTube",
        totalFollowers: 930,
        totalPosts: 25,
        avgEngagementRate: "4.1",
        metrics: {
          audienceGrowth: [
            { day: "Mon", value: 50 },
            { day: "Tue", value: 60 },
            { day: "Wed", value: 70 },
            { day: "Thu", value: 65 },
            { day: "Fri", value: 80 },
            { day: "Sat", value: 90 },
            { day: "Sun", value: 85 },
          ],
          postEngagement: { likes: 300, comments: 100, shares: 50, total: 450 },
        },
      },
    ],
  };
}
