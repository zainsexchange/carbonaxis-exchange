import "dotenv/config";
import OpenAI from "openai";

function requireEnvironmentVariable(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} environment variable is missing.`);
  }

  return value;
}

export const openai = new OpenAI({
  apiKey: requireEnvironmentVariable("OPENAI_API_KEY"),
  timeout: 60_000,
  maxRetries: 3,
});

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

export default openai;