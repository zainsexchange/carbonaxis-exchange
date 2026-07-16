import fs from "fs";
import path from "path";

const root = process.cwd();

const replacements = [
  // punctuation / latin
  ["â€”", "—"],
  ["â€“", "–"],
  ["â€œ", '"'],
  ["â€", '"'],
  ["â€˜", "'"],
  ["â€™", "'"],
  ["â€¦", "…"],
  ["â€¢", "•"],
  ["Â·", "·"],
  ["Â©", "©"],
  ["â‚‚", "₂"],
  ["â–¼", "▼"],
  ["â†", "←"],
  ["â†’", "→"],
  ["âœ•", "✕"],
  ["âœ“", "✓"],
  ["âœ…", "✅"],
  ["âŒ", "✕"],
  ["Donâ€™t", "Don't"],
  ["donâ€™t", "don't"],

  // emoji (prefer simple durable glyphs for UI-critical ones)
  ["ðŸ””", "🔔"],
  ["ðŸ“©", "✉"],
  ["ðŸ“", "📁"],
  ["ðŸ“¬", "✉"],
  ["ðŸ“§", "✉"],
  ["ðŸŒ", "🌐"],
  ["ðŸ¤", "🤝"],
  ["ðŸ“ˆ", "📈"],
  ["â¤ï¸", "♥"],
  ["ðŸ¤", "♡"],
  ["❤️", "♥"],
  ["🤍", "♡"],
];

const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let fixedCount = 0;

for (const file of files) {
  const full = path.join(root, file);
  let text = fs.readFileSync(full, "utf8");
  const before = text;

  for (const [bad, good] of replacements) {
    if (text.includes(bad)) text = text.split(bad).join(good);
  }

  text = text.replace(
    /btn\.innerText\s*=\s*saved\s*\?\s*"[^"]*"\s*:\s*"[^"]*"/g,
    'btn.innerText = saved ? "♥" : "♡"'
  );
  text = text.replace(/btn\.innerText\s*=\s*"[^"]*♥[^"]*"/g, 'btn.innerText = "♥"');
  text = text.replace(/btn\.innerText\s*=\s*"♡"/g, 'btn.innerText = "♡"');

  if (text !== before) {
    fs.writeFileSync(full, text, "utf8");
    fixedCount += 1;
    console.log("fixed", file);
  }
}

console.log("TOTAL", fixedCount);

// verify marketplace critical bits
const m = fs.readFileSync(path.join(root, "marketplace.html"), "utf8");
console.log(
  JSON.stringify({
    middot: (m.match(/·/g) || []).length,
    co2: (m.match(/tCO₂e/g) || []).length,
    emptyHeart: (m.match(/♡/g) || []).length,
    fullHeart: (m.match(/♥/g) || []).length,
    bell: (m.match(/🔔/g) || []).length,
    leftoverMojibake: /â€|Â·|ðŸ|â|âœ|â–|â‚|â†/.test(m),
  })
);
