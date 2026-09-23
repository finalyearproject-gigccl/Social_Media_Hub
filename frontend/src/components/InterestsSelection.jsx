import { useState } from "react";
import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;

// Predefined interest categories
export const INTEREST_OPTIONS = [
  { id: "technology", label: "Technology", icon: "💻" },
  { id: "business", label: "Business", icon: "💼" },
  { id: "marketing", label: "Marketing", icon: "📢" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "photography", label: "Photography", icon: "📷" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "food", label: "Food & Dining", icon: "🍽️" },
  { id: "fitness", label: "Health & Fitness", icon: "💪" },
  { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "finance", label: "Finance", icon: "📈" },
  { id: "education", label: "Education", icon: "📚" },
  { id: "lifestyle", label: "Lifestyle", icon: "🌿" },
  { id: "news", label: "News & Politics", icon: "📰" },
];

export default function InterestsSelection({ onComplete, showSkip = false }) {
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const toggleInterest = (interestId) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((id) => id !== interestId)
        : [...prev, interestId],
    );
  };

  const handleSubmit = async () => {
    if (selectedInterests.length === 0) {
      setError("Please select at least one interest");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/api/auth/interests`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ interests: selectedInterests }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store updated user info
        localStorage.setItem("user", JSON.stringify(data.user));
        onComplete?.(selectedInterests);
      } else {
        const err = await response.json();
        setError(err.error || "Failed to save interests");
      }
    } catch (err) {
      setError("Error saving interests");
      console.error("Error saving interests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete?.([]);
  };

  return (
    <div
      className="interests-selection"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: "700px",
          width: "100%",
          margin: "0 auto",
          padding: "2.5rem",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
          borderRadius: "12px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "0.5rem",
            textAlign: "center",
            fontSize: "1.75rem",
            color: "var(--text-primary)",
          }}
        >
          Select Your Interests
        </h2>
        <p
          className="subtitle"
          style={{
            textAlign: "center",
            marginBottom: "2rem",
            color: "var(--text-secondary)",
            fontSize: "1rem",
          }}
        >
          Choose topics you're interested in to personalize your trending
          content
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "12px",
            marginBottom: "2rem",
          }}
        >
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest.id}
              type="button"
              onClick={() => toggleInterest(interest.id)}
              style={{
                padding: "16px 12px",
                border: selectedInterests.includes(interest.id)
                  ? "2px solid var(--primary)"
                  : "2px solid var(--border)",
                borderRadius: "8px",
                background: selectedInterests.includes(interest.id)
                  ? "var(--primary-light)"
                  : "var(--bg-secondary)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ fontSize: "28px" }}>{interest.icon}</span>
              <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                {interest.label}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div
            className="error"
            style={{ marginBottom: "1rem", textAlign: "center" }}
          >
            {error}
          </div>
        )}

        <div
          className="row"
          style={{
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {showSkip && (
            <button
              className="btn"
              onClick={handleSkip}
              type="button"
              disabled={loading}
              style={{ minWidth: "100px" }}
            >
              Skip
            </button>
          )}
          <button
            className="btn btnPrimary"
            onClick={handleSubmit}
            type="button"
            disabled={loading || selectedInterests.length === 0}
            style={{ minWidth: "160px" }}
          >
            {loading
              ? "Saving..."
              : `Save ${selectedInterests.length} Interest${selectedInterests.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
