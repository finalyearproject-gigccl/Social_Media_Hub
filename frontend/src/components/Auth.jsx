import { useState } from "react";
import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;

export default function Auth({ onLogin, theme, toggleTheme }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);
    if (signupPassword !== signupConfirmPassword) {
      setSignupError("Passwords do not match");
      setSignupLoading(false);
      return;
    }
    if (signupPassword.length < 6) {
      setSignupError("Password must be at least 6 characters");
      setSignupLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registration failed");
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setSignupError(err.message || "Registration failed");
    } finally {
      setSignupLoading(false);
    }
  }

  return (
    <div className="authWrap">
      {/* ── Left decorative panel ── */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-hero-icon">🚀</div>
          <h2 className="auth-hero-title">SocialHub</h2>
          <p className="auth-hero-sub">
            Manage all your social platforms, analytics, and posts from one powerful dashboard.
          </p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">📊</div>
              Unified analytics across all platforms
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">✦</div>
              Publish to Instagram, YouTube & more
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">🤖</div>
              AI assistant powered by Gemini
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">📥</div>
              Manage inbox & comments in one place
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-right">
        {/* Theme toggle */}
        <div className="auth-theme-toggle-wrap">
          <div
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to Dark" : "Switch to Light"}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && toggleTheme()}
          />
        </div>

        <div className="authCard">
          <div className="auth-form-header">
            <h1 className="auth-form-title">
              {isLogin ? "Welcome back 👋" : "Create account ✦"}
            </h1>
            <p className="auth-form-sub">
              {isLogin
                ? "Sign in to your SocialHub account"
                : "Join thousands of creators managing their presence"}
            </p>
          </div>

          {isLogin ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="field">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button
                className="btn btnPrimary btnFull"
                disabled={loginLoading}
                type="submit"
                style={{ marginTop: 8 }}
              >
                {loginLoading ? "Signing in..." : "Sign In →"}
              </button>
              {loginError && <div className="error">{loginError}</div>}
              <p className="hint">
                Don't have an account?{" "}
                <a href="#" onClick={e => { e.preventDefault(); setIsLogin(false); }}>
                  Create one free
                </a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit}>
              <div className="field">
                <label htmlFor="signup-name">Full name</label>
                <input
                  id="signup-name"
                  type="text"
                  value={signupName}
                  onChange={e => setSignupName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="signup-email">Email address</label>
                <input
                  id="signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="signup-confirm-password">Confirm password</label>
                <input
                  id="signup-confirm-password"
                  type="password"
                  value={signupConfirmPassword}
                  onChange={e => setSignupConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <button
                className="btn btnPrimary btnFull"
                disabled={signupLoading}
                type="submit"
                style={{ marginTop: 8 }}
              >
                {signupLoading ? "Creating account..." : "Get Started →"}
              </button>
              {signupError && <div className="error">{signupError}</div>}
              <p className="hint">
                Already have an account?{" "}
                <a href="#" onClick={e => { e.preventDefault(); setIsLogin(true); }}>
                  Sign in
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
