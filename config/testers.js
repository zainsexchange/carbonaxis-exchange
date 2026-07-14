/**
 * Emails with unlimited AI engine access for internal testing.
 * Does not change Free/Pro/Enterprise for anyone else.
 */
export const UNLIMITED_AI_EMAILS = ["test@test.com", "ali@test.com"];

export function isUnlimitedAiTester(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  return UNLIMITED_AI_EMAILS.includes(normalized);
}
