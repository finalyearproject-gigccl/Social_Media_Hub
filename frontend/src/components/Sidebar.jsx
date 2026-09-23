function initials(name) {
  return String(name || "User")
    .split(" ")
    .map((s) => s.trim()[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Sidebar({
  activeView,
  onViewChange,
  user,
  onLogout,
  theme,
  toggleTheme,
}) {
  const items = [
    { id: "dashboard", label: "Dashboard" },
    { id: "accounts", label: "Connected Accounts" },
    { id: "publish", label: "Publish" },
    { id: "inbox", label: "Inbox" },
    { id: "detailed-analytics", label: "Detailed Analytics" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">Social Media Dashboard</div>

      <nav className="nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={`navBtn ${activeView === item.id ? "navBtnActive" : ""}`}
            onClick={() => onViewChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebarFooter">
        <div className="userBlock">
          <div className="avatar">{initials(user?.name)}</div>
          <div>
            <div className="userName">{user?.name}</div>
            <div className="userEmail">{user?.email}</div>
          </div>
        </div>

        <button
          className="btn btnDanger btnFull"
          onClick={onLogout}
          type="button"
        >
          Logout
        </button>

        <div
          className="theme-toggle"
          onClick={toggleTheme}
          title={
            theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
          }
          style={{ marginTop: "10px" }}
        ></div>
      </div>
    </aside>
  );
}
