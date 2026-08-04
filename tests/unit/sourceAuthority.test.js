import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  resolveSourceAuthorityScore,
  resolveCurationTier,
  buildAuthorityFields,
} from "../../intelligence/config/sourceAuthority.js";

import {
  rankEvidence,
} from "../../intelligence/truth/evidenceRanker.js";

describe("Source authority scoring", () => {
  it("scores government highest", () => {
    assert.equal(
      resolveSourceAuthorityScore({
        sourceClass: "government",
        documentType: "strategy",
        issuingAuthority: "Ministry of Energy and Infrastructure",
      }),
      100
    );
  });

  it("scores IEA / IRENA / World Bank from issuer name", () => {
    assert.equal(
      resolveSourceAuthorityScore({
        sourceClass: "international_organization",
        issuingAuthority: "IEA",
      }),
      97
    );
    assert.equal(
      resolveSourceAuthorityScore({
        sourceClass: "international_organization",
        issuingAuthority: "International Renewable Energy Agency",
      }),
      97
    );
    assert.equal(
      resolveSourceAuthorityScore({
        sourceClass: "international_organization",
        issuingAuthority: "World Bank",
      }),
      96
    );
  });

  it("maps Tier 1 curation for official government strategies", () => {
    assert.equal(
      resolveCurationTier({
        sourceClass: "government",
        documentType: "strategy",
      }),
      1
    );
  });

  it("prefers government evidence over research at equal semantic score", () => {
    const ranking = rankEvidence(
      [
        {
          documentId: "gov-1",
          chunkId: "gov-1-c",
          content: "Green hydrogen policy targets and national roadmap.",
          score: 0.82,
          document: {
            title: "UAE Energy Strategy 2050",
            country: "United Arab Emirates",
            sourceClass: "government",
            documentType: "strategy",
            status: "published",
            issuingAuthority: "Ministry of Energy",
            sourceAuthorityScore: 100,
            curationTier: 1,
          },
        },
        {
          documentId: "res-1",
          chunkId: "res-1-c",
          content: "Green hydrogen policy targets and national roadmap.",
          score: 0.82,
          document: {
            title: "Consultancy white paper",
            country: "United Arab Emirates",
            sourceClass: "research",
            documentType: "report",
            status: "published",
            issuingAuthority: "Private research firm",
            sourceAuthorityScore: 90,
            curationTier: 5,
          },
        },
      ],
      {
        question: "UAE green hydrogen policy",
        limit: 2,
      }
    );

    assert.equal(ranking.evidence[0].documentId, "gov-1");
    assert.ok(
      ranking.evidence[0].evidenceScore >
        ranking.evidence[1].evidenceScore
    );
  });

  it("builds persistable authority fields", () => {
    const fields = buildAuthorityFields({
      sourceClass: "government",
      documentType: "law",
      issuingAuthority: "UAE Cabinet",
    });

    assert.equal(fields.sourceAuthorityScore, 100);
    assert.equal(fields.curationTier, 1);
    assert.equal(fields.sourceTrustScore, 1);
  });
});
