import fs from "fs";

const files = fs.readdirSync(".").filter((f) => f.endsWith(".html"));
const found = new Map();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  // Capture likely mojibake runs
  const patterns = [
    /ðŸ[^<\n\r]{0,8}/g,
    /â€[^<\n\r]{0,3}/g,
    /âœ[^<\n\r]{0,3}/g,
    /â†[^<\n\r]{0,3}/g,
    /â[^<\n\r]{0,4}/g,
    /Â[^A-Za-z0-9\s<>\/=\"-]{0,2}/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const s = m[0];
      found.set(JSON.stringify(s), (found.get(JSON.stringify(s)) || 0) + 1);
    }
  }
}

[...found.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)
  .forEach(([k, v]) => console.log(v, k));
