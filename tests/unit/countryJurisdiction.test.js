import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  applyCountryScope,
  detectRequestedCountries,
  rankEvidence,
  canonicalizeCountry,
} from "../../intelligence/truth/evidenceRanker.js";

import {
  buildTruthPackageFromEvidence,
} from "../../intelligence/truth/documentTruthPackage.js";

function makeHit({
  id,
  country,
  title = "Doc",
  content = "green hydrogen policy targets",
}) {
  return {
    documentId: id,
    chunkId: `${id}-chunk`,
    content,
    score: 0.9,
    document: {
      _id: id,
      title,
      country,
      jurisdiction: country,
      sourceClass: "government",
      status: "published",
      issuingAuthority: "Test Authority",
    },
  };
}

describe("Country jurisdiction gating", () => {
  it("detects Oman from the question even when hits are UAE-only", () => {
    const requested = detectRequestedCountries(
      "what is green hydrogen policy in oman?"
    );

    assert.deepEqual(requested, ["Oman"]);
  });

  it("drops UAE evidence for an Oman-only question", () => {
    const scoped = applyCountryScope(
      [
        makeHit({
          id: "uae-1",
          country: "United Arab Emirates",
          title: "UAE Energy Strategy 2050",
        }),
        makeHit({
          id: "uae-2",
          country: "United Arab Emirates",
          title: "Brief of Energy Strategies",
        }),
      ],
      "what is green hydrogen policy in oman?"
    );

    assert.equal(scoped.results.length, 0);
    assert.equal(scoped.countryFilterApplied, true);
    assert.equal(scoped.jurisdictionMiss, true);
    assert.deepEqual(scoped.requestedCountries, ["Oman"]);
  });

  it("keeps UAE evidence for a UAE question", () => {
    const scoped = applyCountryScope(
      [
        makeHit({
          id: "uae-1",
          country: "United Arab Emirates",
        }),
      ],
      "any energy policy of uae in energy sector in 2050?"
    );

    assert.equal(scoped.results.length, 1);
    assert.equal(scoped.jurisdictionMiss, false);
  });

  it("does not mark Oman asks as SUPPORTED using UAE sources", () => {
    const ranking = rankEvidence(
      [
        makeHit({
          id: "uae-1",
          country: "United Arab Emirates",
          title: "Brief of Energy Strategies to Achieve Net Zero",
        }),
        makeHit({
          id: "uae-2",
          country: "United Arab Emirates",
          title: "UAE Energy Strategy 2050",
        }),
      ],
      {
        question: "what is green hydrojen policy in oman?",
        limit: 8,
      }
    );

    const truth = buildTruthPackageFromEvidence({
      question: "what is green hydrojen policy in oman?",
      evidence: ranking.evidence,
      upstreamStatistics: {
        ranking: ranking.statistics,
      },
    });

    assert.equal(ranking.evidence.length, 0);
    assert.equal(truth.evidence.length, 0);
    assert.equal(truth.citations.length, 0);
    assert.equal(truth.truthStatus.code, "no_evidence");
    assert.equal(Number(truth.confidence.score || 0), 0);
    assert.ok(
      String(truth.truthStatus.reason || "")
        .toLowerCase()
        .includes("oman")
    );
  });

  it("canonicalizes UAE aliases", () => {
    assert.equal(canonicalizeCountry("UAE"), "United Arab Emirates");
    assert.equal(canonicalizeCountry("omani"), "Oman");
  });
});
