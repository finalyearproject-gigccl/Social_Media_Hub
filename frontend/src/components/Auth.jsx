import { useState } from "react";
import config from "../../config/config.json";

const API_BASE = config.REACT_APP_API_BASE;

export default function Auth({ onLogin, theme, toggleTheme }) {
  const [isLogin, setIsLogin] = useState(true);

  // Login states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup states
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store token and user in localStorage
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Store token and user in localStorage
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
      <div className="panel authCard">
        <h1 className="title">Social Media Dashboard</h1>
        <p className="subtitle">
          {isLogin ? "Login" : "Sign up to create an account"}
        </p>

        {isLogin ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              className="btn btnPrimary btnFull"
              disabled={loginLoading}
              type="submit"
            >
              {loginLoading ? "Signing in..." : "Login"}
            </button>

            {loginError ? <div className="error">{loginError}</div> : null}

            <p
              className="hint"
              style={{ textAlign: "center", marginTop: "20px" }}
            >
              Don't have an account?{" "}
              <a
                href="#"
                onClick={() => setIsLogin(false)}
                style={{ color: "var(--primary)", textDecoration: "underline" }}
              >
                Sign up
              </a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit}>
            <div className="field">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="field">
              <label htmlFor="signup-confirm-password">Confirm Password</label>
              <input
                id="signup-confirm-password"
                type="password"
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button
              className="btn btnPrimary btnFull"
              disabled={signupLoading}
              type="submit"
            >
              {signupLoading ? "Creating account..." : "Sign Up"}
            </button>

            {signupError ? <div className="error">{signupError}</div> : null}

            <p
              className="hint"
              style={{ textAlign: "center", marginTop: "20px" }}
            >
              Already have an account?{" "}
              <a
                href="#"
                onClick={() => setIsLogin(true)}
                style={{ color: "var(--primary)", textDecoration: "underline" }}
              >
                Login
              </a>
            </p>
          </form>
        )}

        <div
          className="theme-toggle"
          onClick={toggleTheme}
          title={
            theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
          }
          style={{ marginTop: "20px", marginInline: "auto" }}
        ></div>
      </div>
    </div>
  );
}
