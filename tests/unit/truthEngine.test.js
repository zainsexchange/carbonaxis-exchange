import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  evaluateTruth,
  buildTruthResult,
} from "../../intelligence/truth/truthEngine.js";

import {
  clearReasoningCache,
} from "../../intelligence/cache/reasoningCache.js";

import {
  resetEvidenceSequence,
} from "../../intelligence/truth/evidenceModel.js";

import {
  registerEntity,
  resetEntityRegistry,
} from "../../intelligence/graph/entityRegistry.js";

import {
  TRUTH_STATUS,
} from "../../intelligence/truth/truthConstants.js";

describe("Truth Engine", () => {
  it("supports multi-source evidence", async () => {
    resetEntityRegistry();
    resetEvidenceSequence();
    clearReasoningCache();

    const uae = registerEntity({
      canonicalSubject:
        "United Arab Emirates",
    });
    const gh = registerEntity({
      canonicalSubject: "Green Hydrogen",
    });
    const h2 = registerEntity({
      canonicalSubject: "Hydrogen",
    });

    const result = await evaluateTruth(
      {
        question:
          "Does UAE support Green Hydrogen?",
        retrievedChunks: [
          {
            subjectEntityId: uae.entityId,
            predicate: "SUPPORTS",
            objectEntityId: gh.entityId,
            confidence: 0.92,
            text: "UAE supports Green Hydrogen.",
          },
        ],
        graphEvidence: [
          {
            subjectEntityId: gh.entityId,
            predicate: "IS_A",
            objectEntityId: h2.entityId,
            confidence: 1,
          },
        ],
      },
      { useCache: false },
    );

    assert.equal(
      result.truthStatus,
      TRUTH_STATUS.SUPPORTED,
    );
    assert.ok(result.confidence >= 0.75);
    assert.ok(
      Array.isArray(result.executionTrace),
    );
    assert.ok(result.executionPlan);
  });

  it("flags polarity conflicts", async () => {
    resetEntityRegistry();
    resetEvidenceSequence();
    clearReasoningCache();

    const uae = registerEntity({
      canonicalSubject:
        "United Arab Emirates",
    });
    const gh = registerEntity({
      canonicalSubject: "Green Hydrogen",
    });

    const result = await evaluateTruth(
      {
        question:
          "Does UAE support Green Hydrogen?",
        retrievedChunks: [
          {
            subjectEntityId: uae.entityId,
            predicate: "SUPPORTS",
            objectEntityId: gh.entityId,
            confidence: 0.93,
          },
          {
            subjectEntityId: uae.entityId,
            predicate: "DOES_NOT_SUPPORT",
            objectEntityId: gh.entityId,
            confidence: 0.91,
          },
        ],
      },
      { useCache: false },
    );

    assert.equal(
      result.truthStatus,
      TRUTH_STATUS.CONFLICTING,
    );
    assert.ok(result.confidence < 0.5);
    assert.ok(
      result.recommendations.some((line) =>
        /human review/i.test(line),
      ),
    );
  });
});
