const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pattern =
  /<script>\s*const mobileMenuBtn = document\.querySelector\("\.mobile-menu-btn"\);[\s\S]*?mobileLinks\.forEach\(link => \{\s*link\.addEventListener\("click", closeMobileMenu\);\s*\}\);\s*<\/script>\s*/g;

const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let changed = 0;

for (const file of files) {
  const fp = path.join(root, file);
  const text = fs.readFileSync(fp, "utf8");
  const next = text.replace(pattern, "");
  if (next !== text) {
    fs.writeFileSync(fp, next, "utf8");
    changed += 1;
    console.log("removed inline mobile menu from", file);
  }
}

console.log("done", changed);
