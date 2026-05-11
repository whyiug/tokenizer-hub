"use client";

import {
  Braces,
  Check,
  ChevronDown,
  CircleDot,
  MessageSquare,
  PanelRight,
  Search,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_MODEL, MODELS, type ModelEntry } from "@/data/models";
import {
  compactContext,
  formatNumber,
  renderChat,
  renderTools,
  type ChatMessage,
  type TokenResult,
} from "@/lib/tokenizer";
import {
  DEFAULT_TOKENIZER_API_BASE,
  isUnavailableResult,
  tokenizeModels,
  type BackendTokenizeResult,
} from "@/lib/tokenizer-api";

type Mode = "raw" | "chat" | "tools" | "compare";

const seedMessages: ChatMessage[] = [
  {
    id: "system",
    role: "system",
    content: "You are a helpful assistant",
  },
  {
    id: "user",
    role: "user",
    content: "",
  },
];

const seedTools = `[
  {
    "type": "function",
    "function": {
      "name": "search_models",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        }
      }
    }
  }
]`;

const modeMeta: Record<Mode, { label: string; icon: React.ElementType }> = {
  raw: { label: "Raw", icon: Type },
  chat: { label: "Chat", icon: MessageSquare },
  tools: { label: "Tools", icon: Braces },
  compare: { label: "Compare", icon: PanelRight },
};

const swatches = [
  "bg-[#eadcc7] border-[#c9b38e]",
  "bg-[#dbe6d7] border-[#a8b99e]",
  "bg-[#d7e3ea] border-[#9eb1bd]",
  "bg-[#ead8d2] border-[#c7a8a0]",
  "bg-[#e3ddeb] border-[#b5a8c8]",
  "bg-[#d7e4e1] border-[#9fb7b1]",
  "bg-[#eee2c6] border-[#cfbb84]",
  "bg-[#dee3cf] border-[#aeb895]",
];

const modelKey = (model: ModelEntry) =>
  `${model.name} ${model.provider} ${model.id} ${model.family} ${model.tokenizer.key} ${model.tags.join(" ")}`.toLowerCase();

const modelsById = new Map(MODELS.map((model) => [model.id, model]));
const tokenizerApiBase = process.env.NEXT_PUBLIC_TOKENIZER_API_BASE ?? DEFAULT_TOKENIZER_API_BASE;

type TokenFetchState = {
  requestKey: string;
  results: Record<string, TokenResult>;
  errors: Record<string, string>;
};

const emptyTokenResults: Record<string, TokenResult> = {};
const emptyTokenErrors: Record<string, string> = {};

const tokenResultFromBackend = (result: BackendTokenizeResult, text: string, model: ModelEntry): TokenResult => ({
  text,
  tokens: result.tokens,
  segments: result.segments.map((segment) => {
    const tokens = segment.ids?.length ? segment.ids : [segment.id];
    const tokenStart = segment.tokenStart ?? segment.index;
    const textStart = segment.textStart ?? 0;
    return {
      index: segment.index,
      token: tokens[0],
      tokens,
      tokenStart,
      tokenEnd: segment.tokenEnd ?? tokenStart + tokens.length,
      textStart,
      textEnd: segment.textEnd ?? textStart + segment.text.length,
      text: segment.text,
      piece: segment.piece,
      pieces: segment.pieces,
    };
  }),
  count: result.count,
  contextUsed: model.context ? Math.min(100, (result.count / model.context) * 100) : 0,
  remaining: Math.max(0, model.context - result.count),
});

const formatTokenIds = (tokens: number[]) => tokens.map(String).join(", ");

const formatTokenRange = (tokenStart: number, tokenEnd: number) =>
  tokenEnd - tokenStart > 1 ? `#${tokenStart}-${tokenEnd - 1}` : `#${tokenStart}`;

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL.id);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("All");
  const [rawInput, setRawInput] = useState("Tokens are the in-game currency of this world.");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [toolsInput, setToolsInput] = useState(seedTools);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([
    "openai/gpt-5.5",
    "openai/gpt-4.1",
    "openai/gpt-4",
    "openai/gpt-3.5-turbo",
  ]);
  const [tokenState, setTokenState] = useState<TokenFetchState>({ requestKey: "", results: {}, errors: {} });

  const providers = useMemo(
    () => ["All", ...Array.from(new Set(MODELS.map((model) => model.provider))).sort()],
    [],
  );

  const selectedModel = MODELS.find((model) => model.id === selectedModelId) ?? DEFAULT_MODEL;
  const compareModels = useMemo(
    () => compareIds.map((id) => MODELS.find((model) => model.id === id)).filter((model): model is ModelEntry => Boolean(model)),
    [compareIds],
  );

  const filteredModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MODELS.filter((model) => {
      const providerMatch = provider === "All" || model.provider === provider;
      const queryMatch = !needle || modelKey(model).includes(needle);
      return providerMatch && queryMatch;
    });
  }, [provider, query]);

  const activeText = useMemo(() => {
    if (mode === "raw") return rawInput;
    if (mode === "tools") return renderTools(messages, toolsInput, selectedModel.family);
    return renderChat(messages, selectedModel.family);
  }, [messages, mode, rawInput, selectedModel.family, toolsInput]);

  const tokenModelIds = useMemo(
    () => Array.from(new Set([selectedModel.id, ...compareModels.map((model) => model.id)])),
    [compareModels, selectedModel.id],
  );
  const tokenRequestKey = useMemo(() => JSON.stringify([activeText, tokenModelIds]), [activeText, tokenModelIds]);

  useEffect(() => {
    const controller = new AbortController();

    tokenizeModels(tokenModelIds, activeText, controller.signal, tokenizerApiBase)
      .then((batch) => {
        const nextResults: Record<string, TokenResult> = {};
        const nextErrors: Record<string, string> = {};

        batch.results.forEach((result) => {
          if (isUnavailableResult(result)) {
            nextErrors[result.modelId] = result.error;
            return;
          }

          const model = modelsById.get(result.modelId);
          if (!model) {
            nextErrors[result.modelId] = "Unknown model";
            return;
          }

          nextResults[result.modelId] = tokenResultFromBackend(result, activeText, model);
        });

        tokenModelIds.forEach((modelId) => {
          if (!nextResults[modelId] && !nextErrors[modelId]) {
            nextErrors[modelId] = "Tokenizer unavailable";
          }
        });

        setTokenState({ requestKey: tokenRequestKey, results: nextResults, errors: nextErrors });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Tokenizer unavailable";
        setTokenState({
          requestKey: tokenRequestKey,
          results: {},
          errors: Object.fromEntries(tokenModelIds.map((modelId) => [modelId, message])),
        });
      });

    return () => {
      controller.abort();
    };
  }, [activeText, tokenModelIds, tokenRequestKey]);

  const tokenStateReady = tokenState.requestKey === tokenRequestKey;
  const tokenErrors = useMemo(
    () => (tokenStateReady ? tokenState.errors : emptyTokenErrors),
    [tokenState.errors, tokenStateReady],
  );
  const tokenResults = useMemo(
    () => (tokenStateReady ? tokenState.results : emptyTokenResults),
    [tokenState.results, tokenStateReady],
  );
  const tokenResult = tokenResults[selectedModel.id] ?? null;
  const selectedTokenPending = !tokenStateReady || (!tokenResult && !tokenErrors[selectedModel.id]);
  const visibleSegments = tokenResult?.segments.slice(0, 600) ?? [];
  const visibleTokenIds = useMemo(() => {
    if (!tokenResult) return [];
    return tokenResult.segments.flatMap((segment) =>
      segment.tokens.map((token, offset) => ({
        token,
        tokenIndex: segment.tokenStart + offset,
        segmentIndex: segment.index,
      })),
    ).slice(0, 900);
  }, [tokenResult]);
  const activeSegment =
    activeSegmentIndex === null || !tokenResult
      ? null
      : (tokenResult.segments.find((segment) => segment.index === activeSegmentIndex) ?? null);

  const compareRows = useMemo(
    () =>
      compareModels
        .map((model) => {
          const result = tokenResults[model.id] ?? null;
          const pending = !tokenStateReady || (!result && !tokenErrors[model.id]);
          return { model, result, pending };
        })
        .sort((a, b) => (a.result?.count ?? Number.POSITIVE_INFINITY) - (b.result?.count ?? Number.POSITIVE_INFINITY)),
    [compareModels, tokenErrors, tokenResults, tokenStateReady],
  );

  const updateMessage = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addMessage = () => {
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: items.at(-1)?.role === "user" ? "assistant" : "user",
        content: "",
      },
    ]);
  };

  const removeMessage = (id: string) => {
    setMessages((items) => items.filter((item) => item.id !== id));
  };

  const toggleCompareModel = (id: string) => {
    setCompareIds((items) => {
      if (items.includes(id)) return items.length > 1 ? items.filter((item) => item !== id) : items;
      return [...items.slice(-5), id];
    });
  };

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-[#1d1b18]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-[14px] border border-[#e7e0d7] bg-[#fffefa]/85 px-4 py-3 shadow-[0_1px_0_rgba(29,27,24,0.03)] backdrop-blur sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-3 pr-1">
            <div className="relative size-9 rounded-[12px] border border-[#ded5ca] bg-[#f7f1e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(29,27,24,0.04)]">
              <span className="absolute left-2 top-2 size-3.5 rounded-[4px] bg-[#2f302e]" />
              <span className="absolute right-2 top-3 size-3.5 rounded-[4px] bg-[#d9c8ad]" />
              <span className="absolute bottom-2 left-3.5 size-3.5 rounded-[4px] bg-[#bd8a36]" />
            </div>
            <h1
              aria-label="Tokenizer Hub"
              className="flex items-center gap-1.5 rounded-[11px] border border-[#ded5ca] bg-[#fffaf2] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]"
            >
              <span className="font-mono text-[12px] font-semibold leading-none tracking-[0.08em] text-[#2c2924]">
                Tokenizer
              </span>
              <span className="h-3.5 w-px bg-[#d8c5a8]" />
              <span className="rounded-[6px] bg-[#3b3328] px-1.5 py-1 font-mono text-[11px] font-semibold leading-none tracking-[0.08em] text-[#fff7eb]">
                Hub
              </span>
            </h1>
          </div>

          <div className="relative flex min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-[#8b8378]" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Model"
              className="h-10 w-full rounded-[10px] border border-[#e1d9ce] bg-white px-9 text-[14px] outline-none transition focus:border-[#c9aa78] focus:ring-4 focus:ring-[#eadfcf]/60"
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 rounded-md p-1 text-[#8b8378] hover:bg-[#f2ede6]"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <div className="grid w-full grid-cols-4 items-center gap-1 rounded-[10px] border border-[#e1d9ce] bg-[#f6f2ec] p-1 sm:w-auto">
            {(Object.keys(modeMeta) as Mode[]).map((item) => {
              const Icon = modeMeta[item].icon;
              return (
                <button
                  key={item}
                  onClick={() => setMode(item)}
                  className={`flex h-8 items-center justify-center gap-1.5 rounded-[8px] px-2 text-[13px] font-medium transition sm:px-3 ${
                    mode === item ? "bg-white text-[#1d1b18] shadow-sm" : "text-[#777064] hover:text-[#1d1b18]"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {modeMeta[item].label}
                </button>
              );
            })}
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_420px]">
          <aside className="flex min-h-[460px] flex-col rounded-[16px] border border-[#e7e0d7] bg-[#fffefa] shadow-[0_12px_40px_rgba(63,48,31,0.05)]">
            <div className="flex items-center justify-between border-b border-[#eee7dd] px-4 py-3">
              <div className="text-[13px] font-semibold">Model</div>
              <div className="text-[12px] text-[#8b8378]">{MODELS.length}</div>
            </div>
            <div className="border-b border-[#eee7dd] p-3">
              <label className="relative block">
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="h-9 w-full appearance-none rounded-[10px] border border-[#e1d9ce] bg-white px-3 pr-8 text-[13px] outline-none focus:border-[#c9aa78]"
                >
                  {providers.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-[#8b8378]" aria-hidden />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {filteredModels.map((model) => {
                const selected = selectedModel.id === model.id;
                const compared = compareIds.includes(model.id);
                return (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModelId(model.id)}
                    className={`group mb-1 flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition ${
                      selected ? "bg-[#f3eadb]" : "hover:bg-[#f6f2ec]"
                    }`}
                  >
                    <span className="mt-0.5 size-2.5 rounded-full bg-[#5f8a6b]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{model.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8b8378]">
                        <span>{model.provider}</span>
                        <span>·</span>
                        <span>{compactContext(model.context)}</span>
                      </span>
                    </span>
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleCompareModel(model.id);
                      }}
                      className={`flex size-5 items-center justify-center rounded-md border ${
                        compared ? "border-[#c9aa78] bg-white text-[#7b5b2e]" : "border-transparent text-transparent"
                      } group-hover:border-[#e1d9ce] group-hover:text-[#8b8378]`}
                    >
                      {compared ? <Check className="size-3" aria-hidden /> : <CircleDot className="size-3" aria-hidden />}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-[460px] flex-col overflow-hidden rounded-[16px] border border-[#e7e0d7] bg-[#fffefa] shadow-[0_12px_40px_rgba(63,48,31,0.05)]">
            <div className="flex items-center justify-between border-b border-[#eee7dd] px-4 py-3">
              <div>
                <div className="text-[13px] font-semibold">Input</div>
                <div className="mt-0.5 text-[12px] text-[#8b8378]">{selectedModel.name}</div>
              </div>
              <span className="rounded-full bg-[#e8f0ec] px-2.5 py-1 text-[11px] font-medium text-[#44644c]">
                Exact
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {mode === "raw" ? (
                <textarea
                  data-testid="raw-input"
                  value={rawInput}
                  onChange={(event) => setRawInput(event.target.value)}
                  className="min-h-[520px] w-full resize-none rounded-[14px] border border-[#e1d9ce] bg-[#fcfbf7] p-4 font-mono text-[13px] leading-6 outline-none transition focus:border-[#c9aa78] focus:ring-4 focus:ring-[#eadfcf]/60"
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((message) => (
                    <div key={message.id} className="grid grid-cols-[116px_minmax(0,1fr)_32px] gap-2">
                      <select
                        value={message.role}
                        onChange={(event) =>
                          updateMessage(message.id, { role: event.target.value as ChatMessage["role"] })
                        }
                        className="h-10 rounded-[10px] border border-[#e1d9ce] bg-white px-3 text-[13px] outline-none focus:border-[#c9aa78]"
                      >
                        <option value="system">system</option>
                        <option value="user">user</option>
                        <option value="assistant">assistant</option>
                        <option value="tool">tool</option>
                      </select>
                      <textarea
                        value={message.content}
                        onChange={(event) => updateMessage(message.id, { content: event.target.value })}
                        placeholder="Content"
                        rows={2}
                        className="min-h-10 resize-y rounded-[10px] border border-[#e1d9ce] bg-[#fcfbf7] px-3 py-2 text-[13px] leading-5 outline-none focus:border-[#c9aa78] focus:ring-4 focus:ring-[#eadfcf]/60"
                      />
                      <button
                        aria-label="Remove message"
                        onClick={() => removeMessage(message.id)}
                        className="flex size-10 items-center justify-center rounded-[10px] border border-[#e1d9ce] text-[#8b8378] hover:bg-[#f6f2ec]"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addMessage}
                    className="h-10 rounded-[10px] border border-[#ded5ca] bg-white px-4 text-[13px] font-medium hover:bg-[#f6f2ec]"
                  >
                    Add message
                  </button>
                  {mode === "tools" && (
                    <textarea
                      value={toolsInput}
                      onChange={(event) => setToolsInput(event.target.value)}
                      className="min-h-[190px] resize-y rounded-[14px] border border-[#e1d9ce] bg-[#fcfbf7] p-4 font-mono text-[12px] leading-5 outline-none focus:border-[#c9aa78] focus:ring-4 focus:ring-[#eadfcf]/60"
                    />
                  )}
                  <textarea
                    value={activeText}
                    readOnly
                    className="min-h-[210px] resize-y rounded-[14px] border border-[#e1d9ce] bg-[#f8f4ee] p-4 font-mono text-[12px] leading-5 text-[#5f574d] outline-none"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-[460px] flex-col overflow-hidden rounded-[16px] border border-[#e7e0d7] bg-[#fffefa] shadow-[0_12px_40px_rgba(63,48,31,0.05)]">
            <div className="grid grid-cols-3 border-b border-[#eee7dd]">
              <Metric
                label="Tokens"
                value={tokenResult ? formatNumber(tokenResult.count) : selectedTokenPending ? "..." : "—"}
                testId="token-count"
              />
              <Metric
                label="Context"
                value={tokenResult ? `${tokenResult.contextUsed.toFixed(2)}%` : selectedTokenPending ? "..." : "—"}
                testId="context-used"
              />
              <Metric
                label="Remaining"
                value={tokenResult ? compactContext(tokenResult.remaining) : selectedTokenPending ? "..." : "—"}
                testId="remaining-context"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold">Tokens</h2>
                <span className="text-[12px] text-[#8b8378]">
                  {selectedTokenPending ? "loading exact" : tokenResult ? selectedModel.family : "unavailable"}
                </span>
              </div>
              <div className="min-h-[190px] rounded-[14px] border border-[#d7cfc3] bg-[#fffdf9] p-4 font-mono text-[13px] leading-8 shadow-inner">
                {selectedTokenPending ? (
                  <span className="text-[#8b8378]">Loading exact tokenizer...</span>
                ) : visibleSegments.length ? (
                  visibleSegments.map((segment) => {
                    const active = activeSegmentIndex === segment.index;
                    return (
                      <span
                        key={`${segment.index}-${segment.tokens.join("-")}`}
                        title={formatTokenIds(segment.tokens)}
                        onMouseEnter={() => setActiveSegmentIndex(segment.index)}
                        onFocus={() => setActiveSegmentIndex(segment.index)}
                        tabIndex={0}
                        className={`${swatches[segment.index % swatches.length]} mx-px cursor-default rounded-[5px] border px-1 py-0.5 text-[#211f1b] shadow-[inset_0_-1px_0_rgba(29,27,24,0.08)] outline-none transition ${
                          active
                            ? "relative z-10 ring-2 ring-[#8a6a3d] ring-offset-1 ring-offset-white"
                            : "hover:border-[#8a6a3d] hover:ring-2 hover:ring-[#eadfcf]"
                        }`}
                      >
                        {segment.text}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[#8b8378]">Exact tokenizer unavailable.</span>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold">Token ids</div>
                  <div className="min-w-0 truncate rounded-full border border-[#e1d9ce] bg-white px-2.5 py-1 font-mono text-[11px] text-[#5f574d]">
                    {selectedTokenPending
                      ? "loading"
                      : activeSegment
                        ? `${formatTokenIds(activeSegment.tokens)} · ${formatTokenRange(activeSegment.tokenStart, activeSegment.tokenEnd)}`
                        : tokenResult
                          ? `${formatNumber(tokenResult.count)} total`
                          : "unavailable"}
                  </div>
                </div>
                <div className="max-h-[168px] overflow-auto rounded-[14px] border border-[#d7cfc3] bg-[#fffdf9] p-3 font-mono text-[12px] leading-7 text-[#5f574d] shadow-inner">
                  {selectedTokenPending ? (
                    <span className="text-[#8b8378]">Exact token ids will appear when the tokenizer finishes loading.</span>
                  ) : !tokenResult ? (
                    <span className="text-[#8b8378]">No exact tokenizer is available for this model.</span>
                  ) : (
                    visibleTokenIds.map(({ token, tokenIndex, segmentIndex }) => {
                      const active = activeSegmentIndex === segmentIndex;
                      return (
                        <span
                          key={`${tokenIndex}-${token}`}
                          onMouseEnter={() => setActiveSegmentIndex(segmentIndex)}
                          onFocus={() => setActiveSegmentIndex(segmentIndex)}
                          tabIndex={0}
                          className={`mr-1.5 inline-flex rounded-[6px] border px-1.5 py-0.5 outline-none transition ${
                            active
                              ? "border-[#8a6a3d] bg-[#3b3328] text-[#fffaf2] shadow-sm"
                              : "border-[#e1d9ce] bg-white hover:border-[#8a6a3d] hover:bg-[#fbf6ee]"
                          }`}
                        >
                          {token}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-3 text-[13px] font-semibold">Compare</div>
                <div className="overflow-hidden rounded-[14px] border border-[#e1d9ce]">
                  <table className="w-full border-collapse text-left text-[12px]">
                    <thead className="bg-[#f8f4ee] text-[#6f675c]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Model</th>
                        <th className="px-3 py-2 font-medium">Tokens</th>
                        <th className="px-3 py-2 font-medium">Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareRows.map(({ model, result, pending }) => (
                        <tr key={model.id} className="border-t border-[#eee7dd]">
                          <td className="max-w-[190px] truncate px-3 py-2">{model.name}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {result ? formatNumber(result.count) : pending ? "..." : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {result ? `${result.contextUsed.toFixed(2)}%` : pending ? "..." : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="border-r border-[#eee7dd] px-4 py-3 last:border-r-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8b8378]">{label}</div>
      <div data-testid={testId} className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">
        {value}
      </div>
    </div>
  );
}
