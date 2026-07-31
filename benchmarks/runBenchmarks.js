import {
  runGraphBenchmark,
} from "./graphBenchmark.js";

import {
  runPlannerBenchmark,
} from "./plannerBenchmark.js";

import {
  runInferenceBenchmark,
} from "./inferenceBenchmark.js";

import {
  runTruthBenchmark,
} from "./truthBenchmark.js";

const mode =
  process.argv[2] || "smoke";

const config =
  mode === "full"
    ? {
        entities: 10000,
        relationships: 100000,
        plannerIterations: 5000,
        inferenceChain: 500,
        truthIterations: 200,
      }
    : {
        entities: 1000,
        relationships: 5000,
        plannerIterations: 1000,
        inferenceChain: 200,
        truthIterations: 50,
      };

console.log(
  `\nCarbon Brain benchmarks (${mode})\n`,
);

const graph = await runGraphBenchmark({
  entityCount: config.entities,
  relationshipCount: config.relationships,
});
console.log("graph", graph);

const planner = runPlannerBenchmark({
  iterations: config.plannerIterations,
});
console.log("planner", planner);

const inference = runInferenceBenchmark({
  chainLength: config.inferenceChain,
});
console.log("inference", inference);

const truth = await runTruthBenchmark({
  iterations: config.truthIterations,
});
console.log("truth", truth);
