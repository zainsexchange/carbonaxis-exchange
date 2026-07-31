import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const suites = [];

export function describe(name, fn) {
  suites.push({ name, fn });
}

export function it(name, fn) {
  if (!globalThis.__currentSuite) {
    throw new Error("it() must run inside describe()");
  }

  globalThis.__currentSuite.tests.push({
    name,
    fn,
  });
}

export {
  assert,
};

/**
 * @param {string[]} files
 */
export async function runTestFiles(files = []) {
  const results = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  for (const file of files) {
    suites.length = 0;

    await import(
      pathToFileURL(path.resolve(file)).href +
        `?t=${Date.now()}`
    );

    for (const suite of [...suites]) {
      globalThis.__currentSuite = {
        name: suite.name,
        tests: [],
      };

      await suite.fn();

      const tests =
        globalThis.__currentSuite.tests;

      for (const test of tests) {
        try {
          await test.fn();
          results.passed += 1;
          console.log(
            `  ✓ ${suite.name} › ${test.name}`,
          );
        } catch (error) {
          results.failed += 1;
          results.errors.push({
            suite: suite.name,
            test: test.name,
            error,
          });
          console.error(
            `  ✗ ${suite.name} › ${test.name}`,
          );
          console.error(
            `    ${error.message}`,
          );
        }
      }
    }
  }

  globalThis.__currentSuite = null;

  console.log(
    `\n${results.passed} passed, ${results.failed} failed`,
  );

  if (results.failed > 0) {
    process.exitCode = 1;
  }

  return results;
}
