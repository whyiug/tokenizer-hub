"use client";

import type { TokenizerFamily } from "@/data/models";

export type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type TokenSegment = {
  text: string;
  token: number;
  tokens: number[];
  index: number;
  textStart: number;
  textEnd: number;
  tokenStart: number;
  tokenEnd: number;
  piece?: string;
  pieces?: string[];
};

export type TokenResult = {
  text: string;
  tokens: number[];
  segments: TokenSegment[];
  count: number;
  contextUsed: number;
  remaining: number;
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

export const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export const compactContext = (value: number) => {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${Math.round(value / 1000)}K`;
  return String(value);
};
