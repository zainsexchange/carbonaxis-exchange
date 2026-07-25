const DEFAULT_OPTIONS = Object.freeze({
  targetCharacters: 3200,
  maximumCharacters: 4500,
  minimumCharacters: 300,
  overlapCharacters: 350,
  maximumChunks: 5000,
});

function normalizeText(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHeading(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function looksLikeHeading(paragraph = "") {
  const text = paragraph.trim();

  if (!text || text.length > 180 || text.includes("\n")) {
    return false;
  }

  const words = text.split(/\s+/);

  if (words.length > 18) {
    return false;
  }

  const numberedHeading =
    /^(chapter|section|part|article|appendix|annex)\s+[\divxlcdm.-]+/i.test(
      text
    );

  const numericHeading = /^\d+(\.\d+){0,4}[\s.)-]+\S+/.test(text);

  const uppercaseHeading =
    text.length >= 4 &&
    text === text.toUpperCase() &&
    /[A-Z]/.test(text);

  const titleCaseWords = words.filter((word) =>
    /^[A-Z][A-Za-z0-9/&(),'-]*$/.test(word)
  ).length;

  const titleCaseHeading =
    words.length >= 2 &&
    titleCaseWords / words.length >= 0.7 &&
    !/[.!?]$/.test(text);

  return (
    numberedHeading ||
    numericHeading ||
    uppercaseHeading ||
    titleCaseHeading
  );
}

function splitLongParagraph(paragraph, maximumCharacters) {
  const text = paragraph.trim();

  if (text.length <= maximumCharacters) {
    return [text];
  }

  const sentences =
    text.match(/[^.!?\n]+(?:[.!?]+|$)/g)?.map((item) => item.trim()) ||
    [text];

  const parts = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence) continue;

    if (
      current &&
      current.length + sentence.length + 1 > maximumCharacters
    ) {
      parts.push(current.trim());
      current = "";
    }

    if (sentence.length > maximumCharacters) {
      if (current) {
        parts.push(current.trim());
        current = "";
      }

      for (
        let index = 0;
        index < sentence.length;
        index += maximumCharacters
      ) {
        parts.push(
          sentence.slice(index, index + maximumCharacters).trim()
        );
      }

      continue;
    }

    current = current ? `${current} ${sentence}` : sentence;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.filter(Boolean);
}

function createOverlap(previousContent, overlapCharacters) {
  if (!previousContent || overlapCharacters <= 0) {
    return "";
  }

  const tail = previousContent.slice(-overlapCharacters);
  const sentenceBoundary = tail.search(/[.!?]\s+/);

  if (sentenceBoundary >= 0) {
    return tail.slice(sentenceBoundary + 2).trim();
  }

  return tail.trim();
}

function estimateTokenCount(text = "") {
  // Safe approximation for storage and monitoring.
  return Math.ceil(String(text).length / 4);
}

export function chunkDocumentText(text, options = {}) {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    config.targetCharacters < 500 ||
    config.maximumCharacters < config.targetCharacters ||
    config.minimumCharacters < 50 ||
    config.overlapCharacters < 0 ||
    config.overlapCharacters >= config.targetCharacters
  ) {
    throw new Error("Invalid chunking configuration.");
  }

  const cleanedText = normalizeText(text);

  if (cleanedText.length < config.minimumCharacters) {
    throw new Error(
      "Document text is too short to create useful knowledge chunks."
    );
  }

  const rawParagraphs = cleanedText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const blocks = [];

  for (const paragraph of rawParagraphs) {
    const pieces = splitLongParagraph(
      paragraph,
      config.maximumCharacters
    );

    for (const piece of pieces) {
      blocks.push(piece);
    }
  }

  const chunks = [];
  let currentSectionTitle = "";
  let currentParts = [];

  function currentContent() {
    return currentParts.join("\n\n").trim();
  }

  function flushChunk() {
    const content = currentContent();

    if (!content) {
      return;
    }

    const previousChunk = chunks[chunks.length - 1];
    const overlap = previousChunk
      ? createOverlap(
          previousChunk.content,
          config.overlapCharacters
        )
      : "";

    const finalContent =
      overlap && !content.startsWith(overlap)
        ? `${overlap}\n\n${content}`
        : content;

    chunks.push({
      chunkIndex: chunks.length,
      content: finalContent,
      sectionTitle: currentSectionTitle,
      tokenCount: estimateTokenCount(finalContent),
      characterCount: finalContent.length,
    });

    if (chunks.length > config.maximumChunks) {
      throw new Error(
        `Document exceeded the maximum of ${config.maximumChunks} chunks.`
      );
    }

    currentParts = [];
  }

  for (const block of blocks) {
    if (looksLikeHeading(block)) {
      const existingContent = currentContent();

      if (
        existingContent.length >= config.minimumCharacters
      ) {
        flushChunk();
      }

      currentSectionTitle = normalizeHeading(block);
      currentParts.push(block);
      continue;
    }

    const candidate = currentParts.length
      ? `${currentContent()}\n\n${block}`
      : block;

    if (
      candidate.length > config.maximumCharacters &&
      currentContent().length >= config.minimumCharacters
    ) {
      flushChunk();

      if (currentSectionTitle) {
        currentParts.push(currentSectionTitle);
      }
    }

    currentParts.push(block);

    if (
      currentContent().length >= config.targetCharacters
    ) {
      flushChunk();

      if (currentSectionTitle) {
        currentParts.push(currentSectionTitle);
      }
    }
  }

  flushChunk();

  if (!chunks.length) {
    throw new Error("No knowledge chunks could be generated.");
  }

  return {
    chunks,
    statistics: {
      sourceCharacters: cleanedText.length,
      sourceParagraphs: rawParagraphs.length,
      chunkCount: chunks.length,
      averageChunkCharacters: Math.round(
        chunks.reduce(
          (total, chunk) => total + chunk.characterCount,
          0
        ) / chunks.length
      ),
      estimatedTokens: chunks.reduce(
        (total, chunk) => total + chunk.tokenCount,
        0
      ),
    },
    configuration: config,
  };
}