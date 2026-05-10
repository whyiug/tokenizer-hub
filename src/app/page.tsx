"use client";

import {
  Braces,
  Check,
  ChevronDown,
  CircleDot,
  MessageSquare,
  PanelRight,
  Search,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_MODEL, MODELS, type ModelEntry } from "@/data/models";
import {
  compactContext,
  exactEncodingNameForModel,
  formatNumber,
  renderChat,
  renderTools,
  tokenize,
  type ExactEncoding,
  type ExactEncodingName,
  type ChatMessage,
} from "@/lib/tokenizer";

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
  "bg-[#ffd76f] border-[#d19900]",
  "bg-[#9ee8b4] border-[#4aa367]",
  "bg-[#9fd8ff] border-[#4f92c6]",
  "bg-[#ffaea8] border-[#cf675f]",
  "bg-[#ccb7ff] border-[#8064c6]",
  "bg-[#92e5db] border-[#3a9d91]",
  "bg-[#ffbf86] border-[#ca7a2f]",
  "bg-[#d9ec73] border-[#91a838]",
];

const modelKey = (model: ModelEntry) =>
  `${model.name} ${model.provider} ${model.id} ${model.family} ${model.tags.join(" ")}`.toLowerCase();

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL.id);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("All");
  const [rawInput, setRawInput] = useState(
    "你好，world! 这是 tokenizer_hub 的第一版测试。\n\nCompare this prompt across modern AI models.",
  );
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [toolsInput, setToolsInput] = useState(seedTools);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([
    "openai/gpt-5.5",
    "qwen/qwen3.6-flash",
    "deepseek/deepseek-v3.2",
    "anthropic/claude-sonnet-4.5",
  ]);
  const [exactEncodings, setExactEncodings] = useState<Partial<Record<ExactEncodingName, ExactEncoding>>>({});

  const providers = useMemo(
    () => ["All", ...Array.from(new Set(MODELS.map((model) => model.provider))).sort()],
    [],
  );

  const selectedModel = MODELS.find((model) => model.id === selectedModelId) ?? DEFAULT_MODEL;
  const compareModels = useMemo(
    () => compareIds.map((id) => MODELS.find((model) => model.id === id)).filter((model): model is ModelEntry => Boolean(model)),
    [compareIds],
  );
  const exactEncodingNames = useMemo(() => {
    const names = [selectedModel, ...compareModels]
      .map((model) => exactEncodingNameForModel(model))
      .filter((name): name is ExactEncodingName => Boolean(name));
    return Array.from(new Set(names));
  }, [compareModels, selectedModel]);
  const exactEncodingKey = exactEncodingNames.join("|");

  useEffect(() => {
    if (!exactEncodingNames.length) return;

    let cancelled = false;
    import("@/lib/exact-tokenizer")
      .then(({ loadEncoding }) => Promise.all(exactEncodingNames.map((name) => loadEncoding(name))))
      .then((encodings) => {
        if (cancelled) return;
        setExactEncodings((current) => ({
          ...current,
          ...Object.fromEntries(encodings.map((encoding) => [encoding.name, encoding])),
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [exactEncodingKey, exactEncodingNames]);

  const filteredModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MODELS.filter((model) => {
      const providerMatch = provider === "All" || model.provider === provider;
      const queryMatch = !needle || modelKey(model).includes(needle);
      return providerMatch && queryMatch;
    }).slice(0, 42);
  }, [provider, query]);

  const activeText = useMemo(() => {
    if (mode === "raw") return rawInput;
    if (mode === "tools") return renderTools(messages, toolsInput, selectedModel.family);
    return renderChat(messages, selectedModel.family);
  }, [messages, mode, rawInput, selectedModel.family, toolsInput]);

  const selectedExactEncodingName = exactEncodingNameForModel(selectedModel);
  const tokenResult = useMemo(
    () => tokenize(activeText, selectedModel, selectedExactEncodingName ? exactEncodings[selectedExactEncodingName] : undefined),
    [activeText, exactEncodings, selectedExactEncodingName, selectedModel],
  );
  const visibleSegments = tokenResult.segments.slice(0, 600);
  const visibleTokenIds = tokenResult.tokens.slice(0, 900);
  const activeToken = activeTokenIndex === null ? null : tokenResult.segments[activeTokenIndex];

  const compareRows = useMemo(
    () =>
      compareModels
        .map((model) => {
          const exactEncodingName = exactEncodingNameForModel(model);
          const result = tokenize(activeText, model, exactEncodingName ? exactEncodings[exactEncodingName] : undefined);
          return { model, result };
        })
        .sort((a, b) => a.result.count - b.result.count),
    [activeText, compareModels, exactEncodings],
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
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-[9px] border border-[#ded5ca] bg-[#f6f0e7]">
              <Sparkles className="size-4 text-[#7b5b2e]" aria-hidden />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-[-0.01em]">tokenizer_hub</h1>
            </div>
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
                    <span
                      className={`mt-0.5 size-2.5 rounded-full ${
                        model.exactness === "Exact" ? "bg-[#5f8a6b]" : "bg-[#c9a15f]"
                      }`}
                    />
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
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  selectedModel.exactness === "Exact" ? "bg-[#e8f0ec] text-[#44644c]" : "bg-[#f3eadb] text-[#7b5b2e]"
                }`}
              >
                {selectedModel.exactness}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {mode === "raw" ? (
                <textarea
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
              <Metric label="Tokens" value={formatNumber(tokenResult.count)} testId="token-count" />
              <Metric label="Context" value={`${tokenResult.contextUsed.toFixed(2)}%`} testId="context-used" />
              <Metric label="Remaining" value={compactContext(tokenResult.remaining)} testId="remaining-context" />
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold">Tokens</h2>
                <span className="text-[12px] text-[#8b8378]">{selectedModel.family}</span>
              </div>
              <div className="min-h-[190px] rounded-[14px] border border-[#d7cfc3] bg-[#fffdf9] p-4 font-mono text-[13px] leading-8 shadow-inner">
                {visibleSegments.length ? (
                  visibleSegments.map((segment) => {
                    const active = activeTokenIndex === segment.index;
                    return (
                    <span
                      key={`${segment.index}-${segment.token}`}
                      title={`${segment.token}`}
                      onMouseEnter={() => setActiveTokenIndex(segment.index)}
                      onFocus={() => setActiveTokenIndex(segment.index)}
                      tabIndex={0}
                      className={`${swatches[segment.index % swatches.length]} mx-px cursor-default rounded-[5px] border px-1 py-0.5 text-[#191714] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] outline-none transition ${
                        active ? "relative z-10 ring-2 ring-[#1d1b18] ring-offset-1 ring-offset-white" : "hover:ring-1 hover:ring-[#1d1b18]/50"
                      }`}
                    >
                      {segment.text}
                    </span>
                    );
                  })
                ) : (
                  <span className="text-[#8b8378]"> </span>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold">Token ids</div>
                  <div className="min-w-0 truncate rounded-full border border-[#e1d9ce] bg-white px-2.5 py-1 font-mono text-[11px] text-[#5f574d]">
                    {activeToken ? `${activeToken.token} · #${activeToken.index}` : `${formatNumber(tokenResult.count)} total`}
                  </div>
                </div>
                <div className="max-h-[168px] overflow-auto rounded-[14px] border border-[#d7cfc3] bg-[#fffdf9] p-3 font-mono text-[12px] leading-7 text-[#5f574d] shadow-inner">
                  {visibleTokenIds.map((token, index) => {
                    const active = activeTokenIndex === index;
                    return (
                      <span
                        key={`${index}-${token}`}
                        onMouseEnter={() => setActiveTokenIndex(index)}
                        onFocus={() => setActiveTokenIndex(index)}
                        tabIndex={0}
                        className={`mr-1.5 inline-flex rounded-[6px] border px-1.5 py-0.5 outline-none transition ${
                          active
                            ? "border-[#1d1b18] bg-[#1d1b18] text-white shadow-sm"
                            : "border-[#e1d9ce] bg-white hover:border-[#1d1b18]/50"
                        }`}
                      >
                        {token}
                      </span>
                    );
                  })}
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
                      {compareRows.map(({ model, result }) => (
                        <tr key={model.id} className="border-t border-[#eee7dd]">
                          <td className="max-w-[190px] truncate px-3 py-2">{model.name}</td>
                          <td className="px-3 py-2 tabular-nums">{formatNumber(result.count)}</td>
                          <td className="px-3 py-2 tabular-nums">{result.contextUsed.toFixed(2)}%</td>
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
