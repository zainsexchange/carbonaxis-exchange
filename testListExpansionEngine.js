import {
  expandPropositionLists,
} from "./intelligence/truth/listExpansionEngine.js";

const testCases = [
  {
    name: "Standard coordinated list",
    propositions: [
      {
        subject: "The strategy",
        predicate: "supports",
        object:
          "renewable energy, green hydrogen, industrial efficiency, clean transport, energy storage, and emissions reduction.",
        valid: true,
        expanded: false,
      },
    ],
  },

  {
    name: "Protected phrase",
    propositions: [
      {
        subject: "The policy",
        predicate: "supports",
        object:
          "research and development, green hydrogen, and energy storage.",
        valid: true,
        expanded: false,
      },
    ],
  },

  {
    name: "Carbon capture protected phrase",
    propositions: [
      {
        subject: "The framework",
        predicate: "includes",
        object:
          "carbon capture and storage, renewable energy, and industrial efficiency.",
        valid: true,
        expanded: false,
      },
    ],
  },

  {
    name: "No list",
    propositions: [
      {
        subject: "Pakistan",
        predicate: "targets",
        object:
          "60% renewable electricity by 2035.",
        valid: true,
        expanded: false,
      },
    ],
  },

  {
    name: "Possible independent clauses",
    propositions: [
      {
        subject: "The strategy",
        predicate: "supports",
        object:
          "renewable energy, and the government plans to develop hydrogen infrastructure.",
        valid: true,
        expanded: false,
      },
    ],
  },

  {
    name: "Invalid input",
    propositions: null,
  },
];

for (const testCase of testCases) {
  console.log(
    `\n--- ${testCase.name} ---`
  );

  const result =
    expandPropositionLists(
      testCase.propositions
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}