import {
  resolveContextSubject,
} from "./intelligence/truth/contextSubjectResolver.js";

const tests = [
  {
    contextualSentence: {
      contextSubject:
        "Pakistan Green Transition Strategy",
      contextPath: [
        "Pakistan Green Transition Strategy",
        "Energy Targets",
      ],
    },
    proposition: {
      subject: "Pakistan",
      canonicalSubject: "Pakistan",
    },
  },
  {
    contextualSentence: {
      contextSubject: "Saudi Vision 2030",
      contextPath: [
        "Saudi Vision 2030",
        "Renewable Energy",
      ],
    },
    proposition: {
      subject: "Saudi",
      canonicalSubject: "Saudi Arabia",
    },
  },
  {
    contextualSentence: {
      contextSubject:
        "Ministry of Climate Change",
      contextPath: [
        "Ministry of Climate Change",
        "Policy Division",
      ],
    },
    proposition: {
      subject: "Ministry",
      canonicalSubject: "Ministry",
    },
  },
  {
    contextualSentence: {
      contextSubject: "Carbon Axis Exchange Ltd",
      contextPath: [
        "Carbon Axis Exchange Ltd",
        "Climate Markets",
      ],
    },
    proposition: {
      subject: "Carbon Axis Exchange",
      canonicalSubject: "Carbon Axis Exchange",
    },
  },
  {
    contextualSentence: {
      contextSubject: "ISO 14064 Standard",
      contextPath: [
        "ISO 14064 Standard",
        "Greenhouse Gas Accounting",
      ],
    },
    proposition: {
      subject: "ISO",
      canonicalSubject: "ISO",
    },
  },
];

const output = tests.map((test) =>
  resolveContextSubject(
    test.contextualSentence,
    test.proposition,
  ),
);

console.log(
  JSON.stringify(output, null, 2),
);