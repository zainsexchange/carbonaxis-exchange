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
  findNeighbors,
  findConnectedEntities,
  findShortestPath,
  initializeGraphIndexes,
} from "../../intelligence/graph/graphTraversalEngine.js";

describe("Graph Traversal", () => {
  it("finds neighbors and connected entities via BFS", () => {
    const fixture = loadFixture("hydrogen");
    const { entities } =
      loadFixtureIntoRegistries(fixture);

    initializeGraphIndexes();

    const greenId = entities.get(
      "Green Hydrogen",
    );
    const neighbors = findNeighbors(
      greenId,
    );

    assert.ok(neighbors.length >= 1);

    const connected = findConnectedEntities(
      greenId,
      3,
    );

    assert.ok(connected.length >= 2);
  });

  it("finds shortest path between entities", () => {
    const fixture = loadFixture("hydrogen");
    const { entities } =
      loadFixtureIntoRegistries(fixture);

    initializeGraphIndexes();

    const path = findShortestPath(
      entities.get("Green Hydrogen"),
      entities.get("Clean Fuel"),
    );

    assert.ok(Array.isArray(path));
    assert.ok(path.length >= 2);
    assert.equal(
      path[0].entity.canonicalName,
      "Green Hydrogen",
    );
    assert.equal(
      path[path.length - 1].entity
        .canonicalName,
      "Clean Fuel",
    );
  });
});
