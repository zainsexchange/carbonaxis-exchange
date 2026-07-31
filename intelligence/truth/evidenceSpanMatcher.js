function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitIntoParagraphs(text = "") {
  return String(text || "")
    .replace(/\u0000/g, "")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

export function splitIntoSentences(text = "") {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(text = "") {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9.%]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function overlap(a, b) {
  if (!a.length || !b.length) {
    return 0;
  }

  const bSet = new Set(b);

  let matched = 0;

  for (const token of a) {
    if (bSet.has(token)) {
      matched++;
    }
  }

  return matched / a.length;
}

export function findBestEvidenceSpan({
  claim = "",
  content = "",
}) {
  const claimTokens =
    tokenize(claim);

  let best = {
    score: 0,
    paragraphIndex: -1,
    sentenceIndex: -1,
    matchedText: "",
  };

  const paragraphs =
    splitIntoParagraphs(content);

  paragraphs.forEach(
    (paragraph, pIndex) => {

      const sentences =
        splitIntoSentences(paragraph);

      sentences.forEach(
        (sentence, sIndex) => {

          const score =
            overlap(
              claimTokens,
              tokenize(sentence)
            );

          if (score > best.score) {
            best = {
              score,

              paragraphIndex:
                pIndex,

              sentenceIndex:
                sIndex,

              matchedText:
  sentence.trim(),
            };
          }

        }
      );

    }
  );

  return {
    ...best,

    percentage:
      Math.round(
        best.score * 100
      ),
  };
}