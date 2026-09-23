import { useState, useRef, useEffect } from "react";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
// Fallback model used when primary is overloaded
const GEMINI_FALLBACK_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/** Retry a fetch with exponential backoff. Retries on 429 / 503. */
async function fetchWithRetry(url, options, maxRetries = 3) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || res.statusText;
    lastError = new Error(msg);
    // Retry on overload/rate-limit, fall through to fallback model on others
    if (res.status === 429 || res.status === 503) {
      if (attempt < maxRetries - 1) {
        await delay(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
        continue;
      }
    }
    throw lastError;
  }
  throw lastError;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant for a Social Media Hub dashboard. 
You help users with:
- Social media strategy and content ideas
- Analytics interpretation and insights
- Scheduling and publishing tips
- Growing their audience on platforms like Instagram, YouTube, and Discord
- Best practices for social media marketing
Keep responses concise, friendly, and actionable.`;

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "model",
      text: "👋 Hi! I'm your Social Media AI assistant. Ask me anything about growing your audience, content strategy, or analytics!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("gemini_api_key") || ""
  );
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [tempKey, setTempKey] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const saveApiKey = () => {
    const trimmed = tempKey.trim();
    if (!trimmed) return;
    localStorage.setItem("gemini_api_key", trimmed);
    setApiKey(trimmed);
    setShowKeySetup(false);
    setTempKey("");
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!apiKey) {
      setShowKeySetup(true);
      return;
    }

    const userMsg = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build conversation history for Gemini
    const history = messages.slice(1).map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...history,
        { role: "user", parts: [{ text }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };

    try {
      let res;
      try {
        res = await fetchWithRetry(`${GEMINI_API_URL}?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (primaryErr) {
        // Primary model still failing after retries — try fallback model
        res = await fetchWithRetry(`${GEMINI_FALLBACK_URL}?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      const reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't generate a response.";

      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: `⚠️ Error: ${err.message}. Please try again in a moment.`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "model",
        text: "👋 Hi! I'm your Social Media AI assistant. Ask me anything about growing your audience, content strategy, or analytics!",
      },
    ]);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="chatbot-toggle-btn"
        className="chatbot-fab"
        onClick={() => setIsOpen((o) => !o)}
        title="AI Assistant"
        aria-label="Open AI Chatbot"
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <circle cx="9" cy="10" r="1" fill="currentColor" />
            <circle cx="12" cy="10" r="1" fill="currentColor" />
            <circle cx="15" cy="10" r="1" fill="currentColor" />
          </svg>
        )}
        {!isOpen && <span className="chatbot-fab-badge">AI</span>}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window" id="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              </div>
              <div>
                <div className="chatbot-title">Social Media AI</div>
                <div className="chatbot-status" title="Model: gemini-3.6-flash">
                  <span className="chatbot-dot" />
                  Powered by Gemini
                </div>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                className="chatbot-icon-btn"
                onClick={() => setShowKeySetup(true)}
                title="Set API Key"
                id="chatbot-set-key-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </button>
              <button
                className="chatbot-icon-btn"
                onClick={clearChat}
                title="Clear chat"
                id="chatbot-clear-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-3.99" />
                </svg>
              </button>
            </div>
          </div>

          {/* API Key Setup Overlay */}
          {showKeySetup && (
            <div className="chatbot-key-setup">
              <div className="chatbot-key-card">
                <h3>🔑 Gemini API Key</h3>
                <p>
                  Get a <strong>free</strong> API key from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google AI Studio ↗
                  </a>
                  . No credit card required.
                </p>
                <input
                  type="password"
                  placeholder="Paste your Gemini API key..."
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
                  id="chatbot-api-key-input"
                  autoFocus
                />
                <div className="chatbot-key-actions">
                  <button
                    className="chatbot-key-cancel"
                    onClick={() => { setShowKeySetup(false); setTempKey(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="chatbot-key-save"
                    onClick={saveApiKey}
                    disabled={!tempKey.trim()}
                  >
                    Save Key
                  </button>
                </div>
                {apiKey && (
                  <p className="chatbot-key-existing">
                    ✅ A key is already saved.{" "}
                    <button
                      className="chatbot-key-link"
                      onClick={() => {
                        localStorage.removeItem("gemini_api_key");
                        setApiKey("");
                        setShowKeySetup(false);
                      }}
                    >
                      Remove it
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="chatbot-messages" id="chatbot-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`chatbot-msg ${msg.role === "user" ? "chatbot-msg-user" : "chatbot-msg-bot"} ${msg.isError ? "chatbot-msg-error" : ""}`}
              >
                {msg.role === "model" && (
                  <div className="chatbot-msg-avatar">✨</div>
                )}
                <div className="chatbot-msg-bubble">
                  {msg.text.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < msg.text.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-msg chatbot-msg-bot">
                <div className="chatbot-msg-avatar">✨</div>
                <div className="chatbot-msg-bubble chatbot-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* No API Key Banner */}
          {!apiKey && (
            <div className="chatbot-no-key">
              <span>⚡ Add a free API key to start chatting</span>
              <button onClick={() => setShowKeySetup(true)} id="chatbot-add-key-btn">
                Add Key
              </button>
            </div>
          )}

          {/* Input */}
          <div className="chatbot-input-area">
            <textarea
              ref={inputRef}
              className="chatbot-input"
              placeholder={apiKey ? "Ask me anything... (Enter to send)" : "Add API key to chat..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={!apiKey || loading}
              id="chatbot-input"
            />
            <button
              className="chatbot-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || loading || !apiKey}
              id="chatbot-send-btn"
              title="Send message"
            >
              {loading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="chatbot-spin">
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
