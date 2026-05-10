"use client";

import { Tiktoken } from "js-tiktoken/lite";
import type { TiktokenEncodingName, TokenizerSpec } from "@/data/models";
import type { ExactEncoding } from "@/lib/tokenizer";

type RankModule = {
  default: ConstructorParameters<typeof Tiktoken>[0];
};

type HfTokenizer = {
  encode: (text: string, options?: { add_special_tokens?: boolean }) => { ids: number[]; tokens: string[] };
  decode: (tokens: number[], options?: { clean_up_tokenization_spaces?: boolean; skip_special_tokens?: boolean }) => string;
};

const encoderCache = new Map<TokenizerSpec["key"], Promise<ExactEncoding>>();

const loadRanks = async (name: TiktokenEncodingName) => {
  if (name === "o200k_base") return ((await import("js-tiktoken/ranks/o200k_base")) as RankModule).default;
  if (name === "p50k_base") return ((await import("js-tiktoken/ranks/p50k_base")) as RankModule).default;
  if (name === "gpt2") return ((await import("js-tiktoken/ranks/gpt2")) as RankModule).default;
  return ((await import("js-tiktoken/ranks/cl100k_base")) as RankModule).default;
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load tokenizer asset ${path}: ${response.status}`);
  return response.json() as Promise<T>;
};

const loadTiktokenEncoding = async (spec: Extract<TokenizerSpec, { type: "tiktoken" }>): Promise<ExactEncoding> => {
  const ranks = await loadRanks(spec.encoding);
  const encoding = new Tiktoken(ranks);
  return {
    key: spec.key,
    label: spec.encoding,
    encode: (text) => encoding.encode(text, "all"),
    decode: (tokens) => (tokens.length ? encoding.decode(tokens) : ""),
  };
};

const loadHfEncoding = async (spec: Extract<TokenizerSpec, { type: "hf" }>): Promise<ExactEncoding> => {
  const [{ Tokenizer }, tokenizerJson, tokenizerConfig] = await Promise.all([
    import("@huggingface/tokenizers"),
    fetchJson<Record<string, unknown>>(`/tokenizers/${spec.asset}/tokenizer.json`),
    fetchJson<Record<string, unknown>>(`/tokenizers/${spec.asset}/tokenizer_config.json`),
  ]);
  const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig) as HfTokenizer;

  return {
    key: spec.key,
    label: spec.asset,
    encode: (text) => tokenizer.encode(text, { add_special_tokens: false }).ids,
    tokenize: (text) => {
      const encoded = tokenizer.encode(text, { add_special_tokens: false });
      return { ids: encoded.ids, pieces: encoded.tokens };
    },
    decode: (tokens) =>
      tokens.length ? tokenizer.decode(tokens, { clean_up_tokenization_spaces: false, skip_special_tokens: false }) : "",
  };
};

export const loadEncoding = (spec: TokenizerSpec) => {
  const cached = encoderCache.get(spec.key);
  if (cached) return cached;

  const pending = spec.type === "tiktoken" ? loadTiktokenEncoding(spec) : loadHfEncoding(spec);

  encoderCache.set(spec.key, pending);
  return pending;
};
