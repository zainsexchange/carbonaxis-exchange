import {
  buildPropositions,
} from "./intelligence/truth/propositionPipeline.js";

const text = `
The strategy supports renewable energy,
green hydrogen,
industrial efficiency,
clean transport,
energy storage,
and emissions reduction.

Pakistan targets 60% renewable electricity by 2035.
`;

const propositions =
  buildPropositions(text);

console.log(
  JSON.stringify(
    propositions,
    null,
    2
  )
);