"use client";

import type { ModelEntry, TokenizerFamily, TokenizerSpec } from "@/data/models";

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

export type EncodedTokens = {
  ids: number[];
  pieces?: string[];
};

export type ExactEncoding = {
  key: TokenizerSpec["key"];
  label: string;
  encode: (text: string) => number[];
  decode: (tokens: number[]) => string;
  tokenize?: (text: string) => EncodedTokens;
};

export const exactTokenizerKeyForModel = (model: ModelEntry) => {
  return model.tokenizer.key;
};

export const renderChat = (messages: ChatMessage[], family: TokenizerFamily) => {
  void family;

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

const displayPieceForToken = (encoding: ExactEncoding, token: number, piece?: string) => {
  try {
    const decoded = encoding.decode([token]);
    if (decoded && !decoded.includes("\uFFFD")) return decoded;
  } catch {
    // Fall through to the tokenizer-provided token string.
  }
  return piece ?? String(token);
};

const exactTokenize = (text: string, model: ModelEntry, encoding: ExactEncoding): TokenResult => {
  const encoded = encoding.tokenize?.(text) ?? { ids: encoding.encode(text) };
  const tokens = encoded.ids;
  const segments = tokens.map((token, index) => ({
    text: displayPieceForToken(encoding, token, encoded.pieces?.[index]),
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

export const tokenize = (text: string, model: ModelEntry, encoding?: ExactEncoding): TokenResult | null => {
  const tokenizerKey = exactTokenizerKeyForModel(model);
  if (encoding && encoding.key === tokenizerKey) {
    return exactTokenize(text, model, encoding);
  }
  return null;
};

export const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export const compactContext = (value: number) => {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${Math.round(value / 1000)}K`;
  return String(value);
};
