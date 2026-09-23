function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderOAuthPage({ platform, success, title, message, details = [] }) {
  const safePlatform = escapeHtml(platform);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const detailMarkup = details
    .map(
      ({ label, value }) =>
        `<div class="detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");
  const statusClass = success ? "success" : "error";
  const statusLabel = success ? "Connected" : "Connection failed";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safePlatform} connection</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #eef4f8; color: #173042; }
      main { width: min(100%, 460px); padding: 40px 36px 32px; text-align: center; background: #fff; border: 1px solid #d6e2e9; border-radius: 18px; box-shadow: 0 18px 45px rgba(23, 48, 66, .12); }
      .mark { width: 64px; height: 64px; margin: 0 auto 22px; display: grid; place-items: center; border-radius: 50%; font-size: 32px; font-weight: 700; }
      .success .mark { background: #d9f5e7; color: #147a49; }
      .error .mark { background: #fde1e1; color: #b42318; }
      .eyebrow { margin: 0 0 10px; color: #607887; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
      h1 { margin: 0; font-size: 26px; line-height: 1.2; }
      p { margin: 14px 0 0; color: #607887; line-height: 1.55; }
      .details { display: grid; gap: 10px; margin: 24px 0; text-align: left; }
      .detail { display: flex; justify-content: space-between; gap: 16px; padding: 12px 14px; background: #f5f8fa; border-radius: 10px; }
      .detail span { color: #607887; }
      .detail strong { overflow-wrap: anywhere; text-align: right; }
      button { width: 100%; border: 0; border-radius: 10px; padding: 12px 16px; background: #173042; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      button:hover { background: #244b62; }
      .hint { margin-top: 14px; font-size: 12px; }
    </style>
  </head>
  <body>
    <main class="${statusClass}">
      <div class="mark">${success ? "&#10003;" : "!"}</div>
      <p class="eyebrow">${safePlatform}</p>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      ${detailMarkup ? `<div class="details">${detailMarkup}</div>` : ""}
      <button type="button" onclick="window.close()">Close window</button>
      <p class="hint">This window will close automatically.</p>
    </main>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "social-account-${success ? "connected" : "connection-failed"}", platform: ${JSON.stringify(platform)} }, "*");
      }
      setTimeout(() => window.close(), 3500);
    </script>
  </body>
</html>`;
}

module.exports = { renderOAuthPage };
