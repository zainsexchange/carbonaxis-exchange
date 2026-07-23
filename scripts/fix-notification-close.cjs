const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const broken =
  /(<div class="notification-menu">[\s\S]*?<div class="notification-list">[\s\S]*?<\/div>\s*\n)(\s*<\/div>\s*\n)(\s*)<div class="profile-menu">/g;

const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let changed = 0;

for (const file of files) {
  const fp = path.join(root, file);
  const text = fs.readFileSync(fp, "utf8");
  if (!text.includes("notification-menu")) continue;

  const next = text.replace(
    broken,
    "$1$2$3</div>\n$3<div class=\"profile-menu\">"
  );

  if (next !== text) {
    fs.writeFileSync(fp, next, "utf8");
    changed += 1;
    console.log("fixed", file);
  }
}

console.log("done", changed);
