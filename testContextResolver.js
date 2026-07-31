import {
  resolveContextBlocks,
} from "./intelligence/truth/contextResolver.js";

const sample = `
Pakistan Green Transition Strategy

Energy Targets

• 60% renewable electricity by 2035
• Expand solar generation
• Develop wind corridors

Finance

1. Mobilize USD 18 billion through green bonds
2. Establish climate investment funds
`;

const blocks = resolveContextBlocks(sample);

console.log(JSON.stringify(blocks, null, 2));
