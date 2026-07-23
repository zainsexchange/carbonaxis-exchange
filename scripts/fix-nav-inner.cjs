const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const broken = /<\/div>\s*\n\s*<\/div>\s*\n\s*<div class="profile-menu">/g;
const fixed = '</div>\n      <div class="profile-menu">';

const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let changed = 0;

for (const file of files) {
  const fp = path.join(root, file);
  const text = fs.readFileSync(fp, "utf8");
  if (!text.includes("notification-menu") || !text.includes("profile-menu")) continue;

  const next = text.replace(broken, fixed);
  if (next !== text) {
    fs.writeFileSync(fp, next, "utf8");
    changed += 1;
    console.log("fixed", file);
  }
}

console.log("done", changed);
