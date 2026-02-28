import { PDFParse } from "pdf-parse";
import type { UIMessage } from "ai";

export type UploadedResumePdf = {
  id: string;
  filename: string;
  mediaType: string;
  url: string;
};

export type ParsedResumePdf = {
  filename: string;
  id: string;
  pageCount: number;
  text: string;
  totalTextChars: number;
};

export type ResumeStructuredInfo = {
  candidateName: string | null;
  degree: string | null;
  education: string | null;
  email: string | null;
  graduationYear: string | null;
  internshipHighlights: string[];
  links: string[];
  major: string | null;
  phone: string | null;
  projectHighlights: string[];
  school: string | null;
  skills: string[];
};

let workerConfigured = false;

const ensurePdfWorker = () => {
  if (workerConfigured) {
    return;
  }

  PDFParse.setWorker("pdfjs-dist/legacy/build/pdf.worker.mjs");
  workerConfigured = true;
};

const normalizeText = (text: string): string =>
  text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const toDefaultFilename = (index: number): string => `resume-${index + 1}.pdf`;

const uniqueStrings = (items: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    const normalized = item.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
};

const firstRegexMatch = (
  text: string,
  pattern: RegExp,
  group = 1
): string | null => {
  const match = text.match(pattern);
  const value = match?.[group]?.trim();
  return value && value.length > 0 ? value : null;
};

const decodeDataUrlToBytes = (dataUrl: string): Uint8Array => {
  const match = dataUrl.match(/^data:([^,]*?),([\s\S]*)$/);

  if (!match) {
    throw new Error("Invalid data URL format.");
  }

  const meta = match[1] ?? "";
  const payload = match[2] ?? "";
  const isBase64 = meta.includes(";base64");

  if (isBase64) {
    return Uint8Array.from(Buffer.from(payload, "base64"));
  }

  return Uint8Array.from(Buffer.from(decodeURIComponent(payload), "utf8"));
};

const readPdfBytes = async (url: string): Promise<Uint8Array> => {
  if (url.startsWith("data:")) {
    return decodeDataUrlToBytes(url);
  }

  if (url.startsWith("https://") || url.startsWith("http://")) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    return new Uint8Array(bytes);
  }

  throw new Error("Unsupported PDF url format.");
};

const clip = (text: string, maxChars: number): { text: string; truncated: boolean } => {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, maxChars)}\n\n[...content truncated...]`,
    truncated: true,
  };
};

const extractSectionLines = (lines: string[], headingPattern: RegExp): string[] => {
  const startIndex = lines.findIndex((line) => headingPattern.test(line));

  if (startIndex < 0) {
    return [];
  }

  const section: string[] = [];

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";

    if (!line) {
      if (section.length > 0) {
        break;
      }
      continue;
    }

    if (
      section.length > 1 &&
      /(教育|技能|项目|实习|经历|工作|荣誉|证书|自我评价|objective|education|skills|projects|experience)/i.test(
        line
      ) &&
      line.length <= 20
    ) {
      break;
    }

    section.push(line);

    if (section.length >= 14) {
      break;
    }
  }

  return section;
};

export const collectUploadedResumePdfs = (
  messages: UIMessage[]
): UploadedResumePdf[] => {
  const results: UploadedResumePdf[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    message.parts.forEach((part, index) => {
      if (part.type !== "file" || part.mediaType !== "application/pdf") {
        return;
      }

      const filename = part.filename?.trim() || toDefaultFilename(results.length);
      const dedupeKey = `${filename}|${part.url}`;

      if (seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      results.push({
        filename,
        id: `${message.id}-file-${index}`,
        mediaType: part.mediaType,
        url: part.url,
      });
    });
  }

  return results;
};

export const selectUploadedResumePdfs = (
  files: UploadedResumePdf[],
  resumeName?: string
): UploadedResumePdf[] => {
  const selector = resumeName?.trim();

  if (!selector) {
    return files;
  }

  const index = Number(selector);

  if (Number.isInteger(index) && index >= 1 && index <= files.length) {
    return [files[index - 1]];
  }

  const lowerSelector = selector.toLowerCase();
  return files.filter((file) => file.filename.toLowerCase().includes(lowerSelector));
};

export const parseResumePdf = async (
  file: UploadedResumePdf
): Promise<ParsedResumePdf> => {
  ensurePdfWorker();

  const pdfBytes = await readPdfBytes(file.url);
  const parser = new PDFParse({ data: pdfBytes });

  try {
    const textResult = await parser.getText();
    const normalized = normalizeText(textResult.text ?? "");
    const pageCount =
      typeof textResult.total === "number" && textResult.total > 0
        ? textResult.total
        : textResult.pages.length;

    return {
      filename: file.filename,
      id: file.id,
      pageCount,
      text: normalized,
      totalTextChars: normalized.length,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};

export const extractResumeStructuredInfo = (
  resumeText: string
): ResumeStructuredInfo => {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const topLines = lines.slice(0, 8);
  const candidateName =
    topLines.find((line) => /^[\u4e00-\u9fa5]{2,4}$/.test(line)) ??
    topLines.find((line) => /^[A-Za-z]+(?:\s+[A-Za-z]+){1,2}$/.test(line)) ??
    null;

  const email = firstRegexMatch(
    resumeText,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
  );
  const phone =
    firstRegexMatch(resumeText, /((?:\+?86[-\s]?)?1[3-9]\d{9})/) ??
    firstRegexMatch(resumeText, /(\+?\d[\d\s-]{7,}\d)/);
  const school =
    lines.find((line) => /(大学|学院|University|College|School)/i.test(line)) ??
    null;
  const education =
    lines.find((line) => /(本科|硕士|博士|大专|Bachelor|Master|PhD|BSc|MSc)/i.test(line)) ??
    null;
  const degree =
    firstRegexMatch(
      resumeText,
      /(本科|硕士|博士|大专|Bachelor(?:'s)?|Master(?:'s)?|PhD|BSc|MSc)/i,
      1
    ) ?? null;
  const major =
    firstRegexMatch(resumeText, /(?:专业|Major)[:：]?\s*([^\n，,;；]{2,40})/i) ??
    lines.find((line) => /(计算机|软件工程|信息管理|电子|数学|统计|金融|会计)/i.test(line)) ??
    null;
  const graduationYear =
    firstRegexMatch(resumeText, /(20\d{2})\s*(?:年)?\s*(?:毕业|graduate)/i) ??
    firstRegexMatch(resumeText, /(20\d{2})\s*(?:届|级)/i);

  const skillSection = extractSectionLines(
    lines,
    /(技能|技术栈|能力标签|skills?)/i
  );
  const skills = uniqueStrings(
    skillSection
      .join(" ")
      .split(/[、,，;；/|·]/)
      .map((skill) => skill.trim())
      .filter((skill) => skill.length >= 2 && skill.length <= 30)
      .slice(0, 18)
  );

  const projectSection = extractSectionLines(lines, /(项目|projects?)/i);
  const internshipSection = extractSectionLines(
    lines,
    /(实习|工作经历|experience|intern)/i
  );

  const projectHighlights = uniqueStrings(projectSection).slice(0, 6);
  const internshipHighlights = uniqueStrings(internshipSection).slice(0, 6);
  const links = uniqueStrings(
    [...resumeText.matchAll(/(https?:\/\/[^\s)]+)/g)].map(
      (match) => match[1] ?? ""
    )
  ).slice(0, 6);

  return {
    candidateName,
    degree,
    education,
    email,
    graduationYear,
    internshipHighlights,
    links,
    major,
    phone,
    projectHighlights,
    school,
    skills,
  };
};

export const clipResumeText = (text: string, maxChars = 12000) =>
  clip(text, maxChars);
