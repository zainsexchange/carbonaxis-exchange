import {
  buildContextualSentences,
} from "./intelligence/truth/contextualSentenceBuilder.js";

const blocks = [
  {
    content: "60% renewable electricity by 2035",
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Energy Targets",
    ],
    type: "listItem",
    sourceLine: 5,
    markerType: "bullet",
    markerValue: "•",
  },
  {
    content: "Expand solar generation",
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Energy Targets",
    ],
    type: "listItem",
    sourceLine: 6,
    markerType: "bullet",
    markerValue: "•",
  },
  {
    content: "Develop wind corridors",
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Energy Targets",
    ],
    type: "listItem",
    sourceLine: 7,
    markerType: "bullet",
    markerValue: "•",
  },
  {
    content: "Mobilize USD 18 billion through green bonds",
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Finance",
    ],
    type: "listItem",
    sourceLine: 11,
    markerType: "number",
    markerValue: "1",
  },
  {
    content: "Establish climate investment funds",
    contextPath: [
      "Pakistan Green Transition Strategy",
      "Finance",
    ],
    type: "listItem",
    sourceLine: 12,
    markerType: "number",
    markerValue: "2",
  },
];

console.log(
  JSON.stringify(
    buildContextualSentences(blocks),
    null,
    2,
  ),
);