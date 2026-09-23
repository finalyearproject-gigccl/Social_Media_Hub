import { useEffect, useState } from "react";
import Auth from "./components/Auth.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Accounts from "./components/Accounts.jsx";
import Onboarding from "./components/Onboarding.jsx";
import InterestsSelection from "./components/InterestsSelection.jsx";
import Placeholder from "./components/Placeholder.jsx";
import DetailedAnalytics from "./components/DetailedAnalytics.jsx";
import Inbox from "./components/Inbox.jsx";
import Publish from "./components/Publish.jsx";
import Chatbot from "./components/Chatbot.jsx";
import config from "../config/config.json";

const PAGE_META = {
  dashboard:           { icon: "▣", label: "Dashboard" },
  accounts:            { icon: "⊞", label: "Connected Accounts" },
  publish:             { icon: "✦", label: "Publish" },
  inbox:               { icon: "⊠", label: "Inbox" },
  "detailed-analytics":{ icon: "⟁", label: "Analytics" },
  calendar:            { icon: "📅", label: "Calendar" },
  library:             { icon: "📚", label: "Library" },
  settings:            { icon: "⚙️", label: "Settings" },
};

function initials(name) {
  return String(name || "U").split(" ").map(s => s[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

function TopBar({ activeView, user, onLogout, theme, toggleTheme }) {
  const meta = PAGE_META[activeView] || { icon: "▣", label: activeView };
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-page-icon">{meta.icon}</span>
        <h1 className="topbar-title">{meta.label}</h1>
      </div>
      <div className="topbar-right">
        <button
          className="btn btnSecondary"
          onClick={toggleTheme}
          type="button"
          id="topbar-theme-toggle"
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          style={{ fontSize: 14, padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>{theme === "light" ? "🌙" : "☀️"}</span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{theme === "light" ? "Dark" : "Light"}</span>
        </button>

        <div className="topbar-user">
          <div className="topbar-avatar">{initials(user?.name)}</div>
          <div className="topbar-user-info">
            <div className="topbar-user-name">{user?.name}</div>
            <div className="topbar-user-role">Member</div>
          </div>
        </div>

        <button
          className="btn btnDanger"
          onClick={onLogout}
          type="button"
          id="topbar-logout-btn"
          style={{ fontSize: 13, padding: "7px 14px" }}
        >
          ↩ Logout
        </button>
      </div>
    </header>
  );
}

const LS_SESSION = "app_session_user";
const LS_THEME = "app_theme";
const API_BASE = config.REACT_APP_API_BASE;

export default function App() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [needsInterests, setNeedsInterests] = useState(false);
  const [isNewRegistration, setIsNewRegistration] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [theme, setTheme] = useState(() => {
    // Initialize theme from localStorage or default to 'light'
    const storedTheme = localStorage.getItem(LS_THEME);
    return storedTheme || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          // Validate token by fetching user profile
          const response = await fetch(`${API_BASE}/api/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            localStorage.setItem(LS_SESSION, JSON.stringify(data.user));

            // Fetch accounts to determine if onboarding is needed
            fetchAccounts(data.user);
          } else {
            throw new Error("Invalid token");
          }
        } catch (error) {
          console.error("Token validation failed:", error);
          // Clear invalid token
          localStorage.removeItem("auth_token");
          localStorage.removeItem(LS_SESSION);
        }
      }
    };

    validateToken();
  }, []);

  // Fetch user accounts
  const fetchAccounts = async (currentUser) => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const connectedAccounts = data.accounts.filter(
          (acc) => acc.is_connected === true,
        );
        setAccounts(connectedAccounts);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  function handleLogin(u) {
    setUser(u);
    localStorage.setItem(LS_SESSION, JSON.stringify(u));

    // Check if this is a new user (no interests) - only at signup
    if (!u.interests || u.interests.length === 0) {
      setIsNewRegistration(true);
      setNeedsInterests(true);
    } else {
      fetchAccounts(u);
    }
  }

  function handleInterestsComplete(interests) {
    const updatedUser = { ...user, interests };
    setUser(updatedUser);
    localStorage.setItem(LS_SESSION, JSON.stringify(updatedUser));
    setNeedsInterests(false);
    setIsNewRegistration(false);
    fetchAccounts(updatedUser);
  }

  function handleLogout() {
    setUser(null);
    setAccounts([]);
    setLoadingAccounts(true);
    setNeedsInterests(false);
    setIsNewRegistration(false);
    localStorage.removeItem(LS_SESSION);
    localStorage.removeItem("auth_token");
    setActiveView("dashboard");
  }

  if (!user) {
    return (
      <Auth onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
    );
  }

  // Show interests selection only at signup (when isNewRegistration is true)
  if (needsInterests && isNewRegistration) {
    return (
      <InterestsSelection
        onComplete={handleInterestsComplete}
        showSkip={true}
      />
    );
  }

  // Check if user has connected accounts
  const hasConnectedAccounts = accounts.length > 0;

  let content = null;

  if (!hasConnectedAccounts && loadingAccounts) {
    content = (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"var(--muted)", gap:10, fontSize:15 }}>
        <span style={{ display:"inline-block", animation:"chatbot-spin 1.2s linear infinite" }}>⚙️</span>
        Loading...
      </div>
    );
  } else if (activeView === "dashboard") {
    content = hasConnectedAccounts ? <Dashboard /> : <Onboarding />;
  } else if (activeView === "accounts") content = <Accounts />;
  else if (activeView === "publish") content = <Publish />;
  else if (activeView === "inbox") content = <Inbox />;
  else if (activeView === "calendar") content = <Placeholder title="Calendar" />;
  else if (activeView === "library") content = <Placeholder title="Library" />;
  else if (activeView === "settings") content = <Placeholder title="Settings" />;
  else if (activeView === "detailed-analytics") content = <DetailedAnalytics />;
  else content = <Placeholder title="Page" />;

  return (
    <div className="container">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        user={user}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className="content">
        <TopBar activeView={activeView} user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        <div className="page-body">{content}</div>
      </main>
      <Chatbot />
    </div>
  );
}
