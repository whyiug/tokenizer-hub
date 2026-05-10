"use client";

import type { ModelEntry, TokenizerFamily } from "@/data/models";

export type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type TokenSegment = {
  text: string;
  token: number;
  index: number;
};

export type TokenResult = {
  text: string;
  tokens: number[];
  segments: TokenSegment[];
  count: number;
  contextUsed: number;
  remaining: number;
};

export type ExactEncodingName = "o200k_base" | "cl100k_base" | "p50k_base" | "gpt2";

export type ExactEncoding = {
  name: ExactEncodingName;
  encode: (text: string, allowedSpecial: "all") => number[];
  decode: (tokens: number[]) => string;
};

const FAMILY_MULTIPLIER: Record<TokenizerFamily, number> = {
  o200k: 0.92,
  cl100k: 1,
  p50k: 1.12,
  gpt2: 1.12,
  qwen: 0.98,
  deepseek: 1.02,
  llama: 1.08,
  mistral: 1.06,
  gemma: 1.05,
  claude: 1.03,
  gemini: 0.96,
  kimi: 1.01,
  grok: 1.04,
  other: 1.08,
};

const SPECIAL_TOKENS = new Set(["<|im_start|>", "<|im_end|>", "<tool_call>", "</tool_call>"]);

export const exactEncodingNameForFamily = (family: TokenizerFamily): ExactEncodingName | null => {
  if (family === "o200k") return "o200k_base";
  if (family === "cl100k") return "cl100k_base";
  if (family === "p50k") return "p50k_base";
  if (family === "gpt2") return "gpt2";
  return null;
};

export const exactEncodingNameForModel = (model: ModelEntry) => {
  if (model.exactness !== "Exact") return null;
  return exactEncodingNameForFamily(model.family);
};

export const renderChat = (messages: ChatMessage[], family: TokenizerFamily) => {
  const sep = family === "claude" ? "\n\n" : "\n";
  if (family === "claude") {
    return messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
      .join(sep)
      .trim();
  }

  return `${messages
    .map((message) => `<|im_start|>${message.role}\n${message.content.trim()}<|im_end|>`)
    .join("\n")}\n<|im_start|>assistant\n`;
};

export const renderTools = (messages: ChatMessage[], toolsJson: string, family: TokenizerFamily) => {
  const chat = renderChat(messages, family);
  const cleanedTools = toolsJson.trim();
  if (!cleanedTools) return chat;
  return `${chat}\n<tool_call>\n${cleanedTools}\n</tool_call>`;
};

const splitVisibleUnits = (text: string) =>
  text.match(/<\|im_start\|>|<\|im_end\|>|<\/?tool_call>|\s+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[A-Za-z0-9_]+|[^\s]/gu) ?? [];

const estimateUnitTokens = (unit: string, family: TokenizerFamily) => {
  if (SPECIAL_TOKENS.has(unit)) return 1;
  if (/^\s+$/.test(unit)) return Math.max(1, Math.ceil(unit.length / 6));
  if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u.test(unit)) return 1;
  if (/^[A-Za-z0-9_]+$/.test(unit)) return Math.max(1, Math.ceil(unit.length / 4));
  const base = Math.max(1, Math.ceil([...unit].length / 2));
  return Math.max(1, Math.round(base * FAMILY_MULTIPLIER[family]));
};

export const estimateTokenize = (text: string, model: ModelEntry): TokenResult => {
  const units = splitVisibleUnits(text);
  const tokens: number[] = [];
  const segments: TokenSegment[] = [];

  units.forEach((unit) => {
    const amount = estimateUnitTokens(unit, model.family);
    const segmentTokens = Array.from({ length: amount }, (_, offset) => 90_000 + tokens.length + offset);
    tokens.push(...segmentTokens);
    segments.push({
      text: unit,
      token: segmentTokens[0],
      index: segments.length,
    });
  });

  return {
    text,
    tokens,
    segments,
    count: tokens.length,
    contextUsed: model.context ? Math.min(100, (tokens.length / model.context) * 100) : 0,
    remaining: Math.max(0, model.context - tokens.length),
  };
};

const exactTokenize = (text: string, model: ModelEntry, encoding: ExactEncoding): TokenResult => {
  const tokens = encoding.encode(text, "all");
  const segments = tokens.map((token, index) => ({
    text: encoding.decode([token]),
    token,
    index,
  }));

  return {
    text,
    tokens,
    segments,
    count: tokens.length,
    contextUsed: model.context ? Math.min(100, (tokens.length / model.context) * 100) : 0,
    remaining: Math.max(0, model.context - tokens.length),
  };
};

export const tokenize = (text: string, model: ModelEntry, encoding?: ExactEncoding): TokenResult => {
  const exactEncodingName = exactEncodingNameForModel(model);
  if (encoding && exactEncodingName && encoding.name === exactEncodingName) {
    try {
      return exactTokenize(text, model, encoding);
    } catch {
      return estimateTokenize(text, model);
    }
  }
  return estimateTokenize(text, model);
};

export const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export const compactContext = (value: number) => {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${Math.round(value / 1000)}K`;
  return String(value);
};
