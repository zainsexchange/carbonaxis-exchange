import {
  describe,
  it,
  assert,
} from "../harness.js";

import {
  registerEntity,
  getEntityById,
  getEntityByName,
  listEntities,
  resetEntityRegistry,
  getRegistrySize,
} from "../../intelligence/graph/entityRegistry.js";

describe("Entity Registry", () => {
  it("registers and deduplicates entities", () => {
    resetEntityRegistry();

    const first = registerEntity({
      canonicalSubject: "Green Hydrogen",
      entityType: "TECHNOLOGY",
    });

    const second = registerEntity({
      canonicalSubject: "Green Hydrogen",
      entityType: "TECHNOLOGY",
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(
      first.entityId,
      second.entityId,
    );
    assert.equal(getRegistrySize(), 1);
  });

  it("looks up entities by id and name", () => {
    resetEntityRegistry();

    const created = registerEntity({
      canonicalSubject: "Solar PV",
      entityType: "TECHNOLOGY",
    });

    const byId = getEntityById(
      created.entityId,
    );
    const byName = getEntityByName(
      "Solar PV",
    );

    assert.equal(
      byId.canonicalName,
      "Solar PV",
    );
    assert.equal(
      byName.entityId,
      created.entityId,
    );
    assert.equal(listEntities().length, 1);
  });
});
