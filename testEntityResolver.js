import {
  resolveEntity,
  resolveEntities,
} from "./intelligence/truth/entityResolver.js";

console.log(resolveEntity("Pakistan"));
console.log(resolveEntity("Government of Pakistan"));
console.log(resolveEntity("GoP"));
console.log(resolveEntity("United Arab Emirates"));
console.log(resolveEntity("UAE"));
console.log(resolveEntity("KSA"));
console.log(resolveEntity("Saudi Arabia"));

const propositions = [
  {
    subject: "Government of Pakistan",
    predicate: "targets",
    object: "60% renewable electricity by 2035",
  },
  {
    subject: "UAE",
    predicate: "supports",
    object: "green hydrogen",
  },
];

console.log(
  JSON.stringify(
    resolveEntities(propositions),
    null,
    2
  )
);
