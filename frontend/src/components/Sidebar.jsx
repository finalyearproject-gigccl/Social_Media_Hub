function initials(name) {
  return String(name || "U").split(" ").map(s => s[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

const NAV_ITEMS = [
  { id: "dashboard",          label: "Dashboard",      icon: "▣" },
  { id: "accounts",           label: "Accounts",       icon: "⊞" },
  { id: "publish",            label: "Publish",        icon: "✦" },
  { id: "inbox",              label: "Inbox",          icon: "⊠" },
  { id: "detailed-analytics", label: "Analytics",      icon: "⟁" },
];

export default function Sidebar({ activeView, onViewChange, user, onLogout, theme, toggleTheme }) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-icon">🚀</div>
        <div className="brand-text">
          <div className="brand-name">SocialHub</div>
          <div className="brand-tagline">Pro Dashboard</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-section-label">Navigation</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`navBtn ${activeView === item.id ? "navBtnActive" : ""}`}
            onClick={() => onViewChange(item.id)}
            type="button"
            title={item.label}
          >
            <span className="navBtn-icon">{item.icon}</span>
            <span className="navBtn-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebarFooter">
        <div className="userBlock">
          <div className="avatar">{initials(user?.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="userName">{user?.name}</div>
            <div className="userEmail">{user?.email}</div>
          </div>
        </div>

        <button className="sidebar-logout-btn" onClick={onLogout} type="button" id="sidebar-logout-btn" title="Logout">
          <span style={{ fontSize: 15 }}>↩</span>
          <span className="sidebar-logout-label">Logout</span>
        </button>

        <div className="theme-toggle-row">
          <span className="theme-toggle-label">
            {theme === "light" ? "☀️ Light mode" : "🌙 Dark mode"}
          </span>
          <div
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to Dark" : "Switch to Light"}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && toggleTheme()}
          />
        </div>
      </div>
    </aside>
  );
}
