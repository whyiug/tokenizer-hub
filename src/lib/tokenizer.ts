"use client";

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

export const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export const compactContext = (value: number) => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const rounded = Math.round(millions);
    if (Math.abs(millions - rounded) < 0.05) return `${rounded}M`;
    return `${Number(millions.toFixed(1))}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1000)}K`;
  return String(value);
};
