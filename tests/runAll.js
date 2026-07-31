import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

import {
  runTestFiles,
} from "./harness.js";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
);

function collectTests(dir) {
  const absolute = path.join(__dirname, dir);

  try {
    return readdirSync(absolute)
      .filter((name) =>
        name.endsWith(".test.js"),
      )
      .map((name) =>
        path.join(absolute, name),
      );
  } catch {
    return [];
  }
}

const groups = process.argv.slice(2);
const selected =
  groups.length > 0
    ? groups
    : ["unit", "integration", "regression"];

const files = selected.flatMap(
  (group) => collectTests(group),
);

console.log(
  `\nRunning ${files.length} test file(s): ${selected.join(", ")}\n`,
);

await runTestFiles(files);
