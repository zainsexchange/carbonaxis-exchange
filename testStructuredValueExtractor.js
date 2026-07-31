import {
  extractStructuredValue,
  enrichPropositionValues,
} from "./intelligence/truth/structuredValueExtractor.js";

const valueTests = [
  {
    name: "Percentage target",
    value:
      "60% renewable electricity by 2035",
  },

  {
    name: "Currency commitment",
    value:
      "USD 18 billion through green bonds",
  },

  {
    name: "Capacity target",
    value:
      "15 GW of solar capacity by 2030",
  },

  {
    name: "Emissions measurement",
    value:
      "35 MtCO2e emissions reduction by 2040",
  },

  {
    name: "Year range",
    value:
      "implementation period 2025-2030",
  },

  {
    name: "Plain year",
    value:
      "net-zero target in 2050",
  },

  {
    name: "No structured value",
    value:
      "renewable energy development",
  },
];

for (const test of valueTests) {
  console.log(
    `\n--- ${test.name} ---`
  );

  console.log(
    JSON.stringify(
      extractStructuredValue(
        test.value
      ),
      null,
      2
    )
  );
}

console.log(
  "\n--- Proposition enrichment ---"
);

const propositions = [
  {
    subject: "Pakistan",
    predicate: "targets",
    object:
      "60% renewable electricity by 2035",
    valid: true,
  },

  {
    subject: "Pakistan",
    predicate:
      "seeks to mobilize",
    object:
      "USD 18 billion through green bonds",
    valid: true,
  },

  {
    subject: "The strategy",
    predicate: "supports",
    object:
      "green hydrogen",
    valid: true,
  },
];

console.log(
  JSON.stringify(
    enrichPropositionValues(
      propositions
    ),
    null,
    2
  )
);
