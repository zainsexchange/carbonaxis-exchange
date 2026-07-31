import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  collectEvidence,
} from "../../intelligence/reasoning/evidenceCollector.js";

import {
  calculateConfidence,
} from "../../intelligence/reasoning/confidenceEngine.js";

import {
  resetEvidenceSequence,
} from "../../intelligence/truth/evidenceModel.js";

describe("Evidence Collector", () => {
  it("normalizes, dedupes, and sorts evidence", () => {
    resetEvidenceSequence();

    const evidence = collectEvidence({
      retrievedChunks: [
        {
          subjectEntityId: "a",
          predicate: "SUPPORTS",
          objectEntityId: "b",
          confidence: 0.8,
        },
        {
          subjectEntityId: "a",
          predicate: "SUPPORTS",
          objectEntityId: "b",
          confidence: 0.8,
        },
      ],
      graphEvidence: [
        {
          subjectEntityId: "b",
          predicate: "IS_A",
          objectEntityId: "c",
          confidence: 1,
        },
      ],
    });

    assert.equal(evidence.length, 2);
    assert.ok(
      evidence[0].confidence >=
        evidence[1].confidence,
    );
    assert.ok(evidence[0].evidenceId);
    assert.ok(evidence[0].sourceType);
  });
});

describe("Confidence Engine", () => {
  it("returns overall and per-source confidence", () => {
    resetEvidenceSequence();

    const evidence = collectEvidence({
      retrievedChunks: [
        {
          subjectEntityId: "a",
          predicate: "SUPPORTS",
          objectEntityId: "b",
          confidence: 0.9,
        },
      ],
      graphEvidence: [
        {
          subjectEntityId: "b",
          predicate: "IS_A",
          objectEntityId: "c",
          confidence: 1,
        },
      ],
    });

    const confidence = calculateConfidence({
      evidence,
      contradictions: [],
    });

    assert.ok(
      confidence.overallConfidence > 0.9,
    );
    assert.equal(
      confidence.documentConfidence,
      0.9,
    );
    assert.equal(
      confidence.graphConfidence,
      1,
    );
  });

  it("penalizes contradictions", () => {
    const evidence = collectEvidence({
      retrievedChunks: [
        {
          subjectEntityId: "a",
          predicate: "SUPPORTS",
          objectEntityId: "b",
          confidence: 0.9,
        },
      ],
    });

    const clean = calculateConfidence({
      evidence,
      contradictions: [],
    });

    const conflicted = calculateConfidence({
      evidence,
      contradictions: [
        {
          type: "POLARITY_CONFLICT",
          supportingEvidence: evidence,
          conflictingEvidence: evidence,
        },
      ],
    });

    assert.ok(
      conflicted.overallConfidence <
        clean.overallConfidence,
    );
  });
});
