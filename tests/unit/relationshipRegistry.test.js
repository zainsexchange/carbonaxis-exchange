import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  registerEntity,
  resetEntityRegistry,
} from "../../intelligence/graph/entityRegistry.js";

import {
  registerRelationship,
  listRelationships,
  createRelationshipKey,
  resetRelationshipRegistry,
  getRelationshipRegistrySize,
} from "../../intelligence/graph/relationshipRegistry.js";

describe("Relationship Registry", () => {
  it("registers entity-to-entity relationships", () => {
    resetEntityRegistry();
    resetRelationshipRegistry();

    const a = registerEntity({
      canonicalSubject: "UAE",
    });
    const b = registerEntity({
      canonicalSubject: "Green Hydrogen",
    });

    registerRelationship({
      subjectEntityId: a.entityId,
      predicate: "SUPPORTS",
      canonicalPredicate: "SUPPORTS",
      objectEntityId: b.entityId,
      object: "Green Hydrogen",
    });

    assert.equal(
      getRelationshipRegistrySize(),
      1,
    );
    assert.equal(
      listRelationships()[0].predicate,
      "SUPPORTS",
    );
  });

  it("builds stable relationship keys", () => {
    const key = createRelationshipKey({
      subjectEntityId: "entity_1",
      predicate: "IS_A",
      objectEntityId: "entity_2",
      object: "Hydrogen",
    });

    assert.match(key, /entity_1/);
    assert.match(key, /is_a|IS_A/i);
    assert.match(key, /entity/);
  });
});
