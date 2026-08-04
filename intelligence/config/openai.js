import "dotenv/config";
import OpenAI from "openai";

function requireEnvironmentVariable(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `${name} environment variable is missing. Copy .env.example to .env and set the value (never commit .env).`
    );
  }

  return value;
}

let openAiClient = null;

export function getOpenAIClient() {
  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: requireEnvironmentVariable("OPENAI_API_KEY"),
      timeout: 60_000,
      maxRetries: 3,
    });
  }

  return openAiClient;
}

/** Lazy proxy — importing this module no longer crashes when the key is absent. */
export const openai = new Proxy(
  {},
  {
    get(_target, property) {
      const client = getOpenAIClient();
      const value = client[property];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export const AI_MODELS = Object.freeze({
  CHAT: String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim(),

  METADATA: String(
    process.env.OPENAI_METADATA_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini"
  ).trim(),

  EMBEDDING: String(
    process.env.EMBEDDING_MODEL ||
      "text-embedding-3-small"
  ).trim(),
});

export const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS || 1536
);

if (
  !Number.isInteger(EMBEDDING_DIMENSIONS) ||
  EMBEDDING_DIMENSIONS < 1 ||
  EMBEDDING_DIMENSIONS > 4096
) {
  throw new Error(
    "EMBEDDING_DIMENSIONS must be an integer between 1 and 4096."
  );
}

if (!String(process.env.OPENAI_API_KEY || "").trim()) {
  console.warn(
    "[Carbon Brain] OPENAI_API_KEY is missing in .env — embeddings and Ask will fail until it is set."
  );
}

export default openai;
