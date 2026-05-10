"use client";

import { Tiktoken } from "js-tiktoken/lite";
import type { ExactEncoding, ExactEncodingName } from "@/lib/tokenizer";

type RankModule = {
  default: ConstructorParameters<typeof Tiktoken>[0];
};

const encoderCache = new Map<ExactEncodingName, Promise<ExactEncoding>>();

const loadRanks = async (name: ExactEncodingName) => {
  if (name === "o200k_base") return ((await import("js-tiktoken/ranks/o200k_base")) as RankModule).default;
  if (name === "p50k_base") return ((await import("js-tiktoken/ranks/p50k_base")) as RankModule).default;
  if (name === "gpt2") return ((await import("js-tiktoken/ranks/gpt2")) as RankModule).default;
  return ((await import("js-tiktoken/ranks/cl100k_base")) as RankModule).default;
};

export const loadEncoding = (name: ExactEncodingName) => {
  const cached = encoderCache.get(name);
  if (cached) return cached;

  const pending = loadRanks(name).then((ranks) => {
    const encoding = new Tiktoken(ranks);
    return {
      name,
      encode: encoding.encode.bind(encoding),
      decode: encoding.decode.bind(encoding),
    };
  });

  encoderCache.set(name, pending);
  return pending;
};
