import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  loadFixture,
  loadFixtureIntoRegistries,
} from "../fixtures/loadFixture.js";

import {
  runInference,
  inferTransitiveRelationships,
} from "../../intelligence/reasoning/inferenceEngine.js";

import {
  resetEntityRegistry,
} from "../../intelligence/graph/entityRegistry.js";

import {
  resetRelationshipRegistry,
} from "../../intelligence/graph/relationshipRegistry.js";

describe("Inference Engine", () => {
  it("infers transitive IS_A relationships", () => {
    resetEntityRegistry();
    resetRelationshipRegistry();

    const fixture = loadFixture(
      "renewable_targets",
    );
    const { entities } =
      loadFixtureIntoRegistries(fixture);

    const inferred =
      inferTransitiveRelationships();

    const solarToEnergy = inferred.find(
      (item) =>
        item.subjectEntityId ===
          entities.get("Solar PV") &&
        item.objectEntityId ===
          entities.get("Energy") &&
        item.predicate === "IS_A",
    );

    assert.ok(solarToEnergy);
    assert.equal(
      solarToEnergy.inferred,
      true,
    );
    assert.equal(
      solarToEnergy.inferenceRule,
      "TRANSITIVE_IS_A",
    );
  });

  it("runInference returns inferred facts without mutating registry", () => {
    const fixture = loadFixture("hydrogen");
    loadFixtureIntoRegistries(fixture);

    const before = runInference();
    const after = runInference();

    assert.ok(before.length >= 1);
    assert.equal(
      before.length,
      after.length,
    );
  });
});
