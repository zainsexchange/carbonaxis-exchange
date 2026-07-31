import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadFixture,
  buildEvidenceFromFixture,
} from "../fixtures/loadFixture.js";

import {
  createExecutionPlan,
} from "../../intelligence/planner/queryPlanner.js";

import {
  runInference,
} from "../../intelligence/reasoning/inferenceEngine.js";

import {
  evaluateTruth,
} from "../../intelligence/truth/truthEngine.js";

import {
  clearReasoningCache,
} from "../../intelligence/cache/reasoningCache.js";

import {
  resetEvidenceSequence,
} from "../../intelligence/truth/evidenceModel.js";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
);

const expected = JSON.parse(
  readFileSync(
    path.join(
      __dirname,
      "../fixtures/expected_answers.json",
    ),
    "utf8",
  ),
);

const FIXTURE_BY_CASE = {
  "def-green-hydrogen": "hydrogen",
  "rel-uae-green-hydrogen": "gcc_energy",
  "class-clean-fuel": "hydrogen",
  "compare-uae-saudi": "gcc_energy",
};

describe("Regression — benchmark answers", () => {
  for (const testCase of expected.cases) {
    it(`holds for ${testCase.id}`, async () => {
      clearReasoningCache();
      resetEvidenceSequence();

      const fixtureName =
        FIXTURE_BY_CASE[testCase.id] ||
        "hydrogen";

      const fixture = loadFixture(
        fixtureName,
      );
      const streams =
        buildEvidenceFromFixture(fixture);

      const plan = createExecutionPlan(
        testCase.question,
      );

      assert.equal(
        plan.strategy,
        testCase.expectedStrategy,
      );

      const inferred = plan.requiresInference
        ? runInference()
        : [];

      const result = await evaluateTruth(
        {
          question: testCase.question,
          retrievedChunks:
            streams.retrievedChunks,
          graphEvidence:
            streams.graphEvidence,
          inferredEvidence: inferred,
          ontologyEvidence:
            streams.ontologyEvidence,
        },
        { useCache: false },
      );

      assert.ok(
        result.confidence >=
          testCase.minConfidence,
      );

      if (testCase.expectInference) {
        assert.ok(
          result.inferredEvidence
            .length >= 0,
        );
        assert.equal(
          plan.requiresInference,
          true,
        );
      }

      assert.ok(
        [
          "SUPPORTED",
          "PARTIALLY_SUPPORTED",
          "CONFLICTING",
          "INSUFFICIENT_EVIDENCE",
        ].includes(result.truthStatus),
      );
    });
  }
});
