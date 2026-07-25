import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
]);

function cleanExtractedText(value = "") {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    return {
      text: cleanExtractedText(result.text),
      pageCount: Number(result.total) || null,
      extractionMethod: "pdf-parse",
    };
  } finally {
    await parser.destroy();
  }
}

async function extractPlainText(filePath) {
  const text = await fs.readFile(filePath, "utf8");

  return {
    text: cleanExtractedText(text),
    pageCount: null,
    extractionMethod: "plain-text",
  };
}

export async function extractDocumentText({
  filePath,
  mimeType,
}) {
  const resolvedPath = path.resolve(String(filePath || ""));

  if (!filePath) {
    throw new Error("File path is required.");
  }

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Text extraction is not supported for MIME type: ${mimeType}`
    );
  }

  try {
    await fs.access(resolvedPath);
  } catch {
    throw new Error("Uploaded document file was not found.");
  }

  let result;

  if (mimeType === "application/pdf") {
    result = await extractPdfText(resolvedPath);
  } else {
    result = await extractPlainText(resolvedPath);
  }

  if (!result.text || result.text.length < 20) {
    throw new Error(
      "No usable text was extracted. The document may be scanned, image-only, encrypted, or empty."
    );
  }

  return {
    ...result,
    characterCount: result.text.length,
    wordCount: result.text.split(/\s+/).filter(Boolean).length,
  };
}