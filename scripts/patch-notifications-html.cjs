const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const replacement = `<div class="notification-menu">
  <button class="notification-btn" type="button" aria-label="Notifications">
    🔔
    <span class="notification-count" hidden>0</span>
  </button>
  <div class="notification-dropdown">
    <div class="notification-list">
      <p class="notification-empty">Loading…</p>
    </div>
  </div>
</div>`;

const re =
  /<div class="notification-menu">[\s\S]*?<div class="notification-dropdown">[\s\S]*?<\/div>\s*<\/div>/g;

const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let changed = 0;

for (const file of files) {
  const fp = path.join(root, file);
  const text = fs.readFileSync(fp, "utf8");
  if (!text.includes("notification-menu")) continue;

  const next = text.replace(re, replacement);
  if (next !== text) {
    fs.writeFileSync(fp, next, "utf8");
    changed += 1;
    console.log("updated", file);
  }
}

console.log("done", changed);
