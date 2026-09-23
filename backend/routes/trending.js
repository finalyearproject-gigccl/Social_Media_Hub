const express = require("express");
const axios = require("axios");
const logger = require("../utils/logger");
const { verifyToken, findUserById } = require("../utils/authUtil");

const router = express.Router();

// News API configuration (using GNews as free alternative)
// You can replace this with any news API of your choice
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "demo";
const GNEWS_BASE_URL = "https://gnews.io/api/v4";

// Fallback mock data when API is unavailable
const getMockTrendingTopics = (interests) => {
  const mockData = {
    technology: [
      {
        title: "AI Revolution Continues",
        description:
          "New breakthroughs in artificial intelligence are transforming industries.",
        source: "Tech Daily",
        url: "#",
        image: null,
      },
      {
        title: "Quantum Computing Advances",
        description:
          "Major tech companies announce significant progress in quantum computing.",
        source: "Tech Weekly",
        url: "#",
        image: null,
      },
      {
        title: "Cybersecurity Trends",
        description:
          "Latest trends in cybersecurity and data protection for 2024.",
        source: "Security Today",
        url: "#",
        image: null,
      },
    ],
    business: [
      {
        title: "Market Analysis",
        description: "Global markets show promising growth in Q2.",
        source: "Business Insider",
        url: "#",
        image: null,
      },
      {
        title: "Startup Ecosystem",
        description: "New startups raising record funding in emerging markets.",
        source: "Entrepreneur",
        url: "#",
        image: null,
      },
      {
        title: "Remote Work Trends",
        description: "How remote work is reshaping the business landscape.",
        source: "Business Weekly",
        url: "#",
        image: null,
      },
    ],
    marketing: [
      {
        title: "Digital Marketing Strategies",
        description: "Effective strategies for modern digital marketing.",
        source: "Marketing Pro",
        url: "#",
        image: null,
      },
      {
        title: "Social Media Trends",
        description: "Latest trends in social media marketing.",
        source: "Social Media Today",
        url: "#",
        image: null,
      },
      {
        title: "Content Marketing",
        description: "Best practices for content marketing in 2024.",
        source: "Content Daily",
        url: "#",
        image: null,
      },
    ],
    design: [
      {
        title: "UI/UX Design Trends",
        description: "Latest trends in user interface and experience design.",
        source: "Design Weekly",
        url: "#",
        image: null,
      },
      {
        title: "Brand Identity",
        description: "How to create memorable brand identities.",
        source: "Creative Studio",
        url: "#",
        image: null,
      },
    ],
    photography: [
      {
        title: "Photography Tips",
        description: "Professional photography tips for beginners.",
        source: "Photo Daily",
        url: "#",
        image: null,
      },
      {
        title: "Camera Gear Reviews",
        description: "Latest camera equipment reviews and comparisons.",
        source: "Camera World",
        url: "#",
        image: null,
      },
    ],
    travel: [
      {
        title: "Travel Destinations",
        description: "Top travel destinations for this year.",
        source: "Travel Magazine",
        url: "#",
        image: null,
      },
      {
        title: "Travel Tips",
        description: "Essential tips for your next adventure.",
        source: "Travel Weekly",
        url: "#",
        image: null,
      },
    ],
    food: [
      {
        title: "Food Trends",
        description: "Latest food trends and culinary innovations.",
        source: "Food Daily",
        url: "#",
        image: null,
      },
      {
        title: "Recipe Ideas",
        description: "Quick and easy recipe ideas for busy professionals.",
        source: "Cooking Class",
        url: "#",
        image: null,
      },
    ],
    fitness: [
      {
        title: "Workout Routines",
        description: "Effective workout routines for all fitness levels.",
        source: "Fitness Pro",
        url: "#",
        image: null,
      },
      {
        title: "Health Tips",
        description: "Essential health and wellness tips.",
        source: "Health Daily",
        url: "#",
        image: null,
      },
    ],
    fashion: [
      {
        title: "Fashion Trends",
        description: "Latest fashion trends for the season.",
        source: "Fashion Weekly",
        url: "#",
        image: null,
      },
      {
        title: "Style Guide",
        description: "Professional style guide for modern professionals.",
        source: "Style Magazine",
        url: "#",
        image: null,
      },
    ],
    entertainment: [
      {
        title: "Movie Reviews",
        description: "Latest movie releases and reviews.",
        source: "Entertainment Daily",
        url: "#",
        image: null,
      },
      {
        title: "Music News",
        description: "Latest music industry news and updates.",
        source: "Music Weekly",
        url: "#",
        image: null,
      },
    ],
    sports: [
      {
        title: "Sports Updates",
        description: "Latest sports news and highlights.",
        source: "Sports Daily",
        url: "#",
        image: null,
      },
      {
        title: "Fitness in Sports",
        description: "How athletes are staying fit.",
        source: "Sports Pro",
        url: "#",
        image: null,
      },
    ],
    finance: [
      {
        title: "Investment Tips",
        description: "Smart investment strategies for beginners.",
        source: "Finance Daily",
        url: "#",
        image: null,
      },
      {
        title: "Market Updates",
        description: "Latest updates from the financial markets.",
        source: "Market Watch",
        url: "#",
        image: null,
      },
    ],
    education: [
      {
        title: "Learning Tips",
        description: "Effective learning strategies for students.",
        source: "Education Daily",
        url: "#",
        image: null,
      },
      {
        title: "Online Courses",
        description: "Best online courses for professional development.",
        source: "Learning Hub",
        url: "#",
        image: null,
      },
    ],
    lifestyle: [
      {
        title: "Lifestyle Tips",
        description: "Tips for a balanced and fulfilling lifestyle.",
        source: "Lifestyle Magazine",
        url: "#",
        image: null,
      },
      {
        title: "Wellness",
        description: "Holistic approaches to wellness and well-being.",
        source: "Wellness Daily",
        url: "#",
        image: null,
      },
    ],
    news: [
      {
        title: "World News",
        description: "Latest updates from around the world.",
        source: "News Daily",
        url: "#",
        image: null,
      },
      {
        title: "Political Updates",
        description: "Current political events and analysis.",
        source: "Political Weekly",
        url: "#",
        image: null,
      },
    ],
  };

  // Collect topics from all user interests
  let allTopics = [];
  interests.forEach((interest) => {
    if (mockData[interest]) {
      allTopics = [...allTopics, ...mockData[interest]];
    }
  });

  // If no matching interests, return general topics
  if (allTopics.length === 0) {
    allTopics = [...mockData.technology, ...mockData.business].slice(0, 6);
  }

  return allTopics.slice(0, 6);
};

// GET /api/trending - Get trending topics based on user interests
router.get("/trending", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get user interests
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userInterests = user.interests || [];

    logger.info(
      `Fetching trending topics for user: ${decoded.userId}, interests: ${userInterests.join(", ")}`,
    );

    let trendingTopics = [];

    // Try to fetch from News API if API key is configured
    if (GNEWS_API_KEY !== "demo") {
      try {
        const queries = userInterests.slice(0, 3); // Use top 3 interests
        const searchQuery =
          queries.length > 0 ? queries.join(" OR ") : "technology business";

        const response = await axios.get(`${GNEWS_BASE_URL}/search`, {
          params: {
            q: searchQuery,
            lang: "en",
            max: 10,
            apikey: GNEWS_API_KEY,
          },
          timeout: 5000,
        });

        if (response.data && response.data.articles) {
          trendingTopics = response.data.articles.map((article) => ({
            title: article.title,
            description: article.description,
            content: article.content,
            source: article.source?.name,
            url: article.url,
            image: article.image,
            publishedAt: article.publishedAt,
          }));
        }
      } catch (apiError) {
        logger.warn(
          `News API error, falling back to mock data: ${apiError.message}`,
        );
      }
    }

    // Fallback to mock data if API failed or no API key
    if (trendingTopics.length === 0) {
      trendingTopics = getMockTrendingTopics(userInterests);
    }

    res.json({
      topics: trendingTopics,
      interests: userInterests,
    });
  } catch (error) {
    logger.error("Error fetching trending topics:", error);
    res.status(500).json({ error: "Failed to fetch trending topics" });
  }
});

module.exports = router;
