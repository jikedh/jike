import { Check, ChevronDown, Search } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "shared/utils/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ModelSelectorOption = {
  value: string;
  label: string;
  provider: string;
};

export type ModelProviderMeta = {
  id: string;
  label: string;
  icon?: ReactNode;
  priority?: number;
};

type ModelSelectorModel = {
  name: string;
  model: string;
  platform: string;
};

type ProviderGroup = ModelProviderMeta & {
  models: ModelSelectorOption[];
};

type ModelSelectorProps = {
  value: string;
  onChange: (model: string) => void;
  models: ModelSelectorModel[];
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
};

const MODEL_PROVIDER_META: Record<string, ModelProviderMeta> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    icon: "AI",
    priority: 10,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    icon: "O",
    priority: 20,
  },
  google: {
    id: "google",
    label: "Google",
    icon: "G",
    priority: 30,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    icon: "DS",
    priority: 40,
  },
  qwen: {
    id: "qwen",
    label: "Qwen",
    icon: "Q",
    priority: 50,
  },
  chatglm: {
    id: "chatglm",
    label: "GLM",
    icon: "GLM",
    priority: 60,
  },
  moonshot: {
    id: "moonshot",
    label: "Moonshot",
    icon: "K",
    priority: 70,
  },
  minimax: {
    id: "minimax",
    label: "MiniMax",
    icon: "M",
    priority: 80,
  },
};

const normalize = (value?: string) => value?.toLowerCase().trim() ?? "";

const getProviderMeta = (provider: string): ModelProviderMeta => {
  const key = normalize(provider);
  const knownMeta = MODEL_PROVIDER_META[key];

  if (knownMeta) {
    return knownMeta;
  }

  const fallbackLabel = provider || "Unknown";

  return {
    id: provider,
    label: fallbackLabel,
    icon: fallbackLabel.slice(0, 1).toUpperCase(),
    priority: 999,
  };
};

const ProviderIcon = ({ icon }: { icon?: ReactNode }) => (
  <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-white/8 px-1.5 text-[10px] font-semibold leading-none text-white/80 ring-1 ring-white/10">
    {icon}
  </span>
);

export const ModelSelector = ({
  value,
  onChange,
  models,
  className,
  triggerClassName,
  placeholder = "选择模型",
}: ModelSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [activeProviderId, setActiveProviderId] = useState("");

  const providerGroups = useMemo<ProviderGroup[]>(() => {
    const groupMap = new Map<string, ProviderGroup>();

    for (const item of models) {
      const provider = item.platform || "unknown";
      const meta = getProviderMeta(provider);
      const currentGroup =
        groupMap.get(provider) ??
        ({
          ...meta,
          id: provider,
          models: [],
        } satisfies ProviderGroup);

      currentGroup.models.push({
        value: item.model,
        label: item.name,
        provider,
      });
      groupMap.set(provider, currentGroup);
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      const priorityDiff = (a.priority ?? 999) - (b.priority ?? 999);
      if (priorityDiff !== 0) return priorityDiff;
      return a.label.localeCompare(b.label);
    });
  }, [models]);

  const selectedModel = useMemo(
    () =>
      providerGroups
        .flatMap((provider) => provider.models)
        .find((model) => model.value === value),
    [providerGroups, value],
  );

  const selectedProvider = useMemo(
    () =>
      providerGroups.find((provider) => provider.id === selectedModel?.provider),
    [providerGroups, selectedModel?.provider],
  );

  const filteredProviders = useMemo(() => {
    const keyword = normalize(providerSearch);
    if (!keyword) return providerGroups;

    return providerGroups.filter((provider) => {
      const providerMatch =
        normalize(provider.label).includes(keyword) ||
        normalize(provider.id).includes(keyword);
      const modelMatch = provider.models.some(
        (model) =>
          normalize(model.label).includes(keyword) ||
          normalize(model.value).includes(keyword),
      );

      return providerMatch || modelMatch;
    });
  }, [providerGroups, providerSearch]);

  useEffect(() => {
    if (!open) return;

    const selectedProviderId = selectedProvider?.id;
    const hasActiveProvider = filteredProviders.some(
      (provider) => provider.id === activeProviderId,
    );
    const selectedProviderIsVisible = filteredProviders.some(
      (provider) => provider.id === selectedProviderId,
    );

    if (hasActiveProvider) return;

    setActiveProviderId(
      selectedProviderIsVisible
        ? (selectedProviderId ?? "")
        : (filteredProviders[0]?.id ?? ""),
    );
  }, [
    activeProviderId,
    filteredProviders,
    open,
    selectedProvider?.id,
  ]);

  useEffect(() => {
    if (!open) {
      setProviderSearch("");
      setModelSearch("");
      setActiveProviderId(selectedProvider?.id ?? providerGroups[0]?.id ?? "");
      return;
    }

    setActiveProviderId(selectedProvider?.id ?? providerGroups[0]?.id ?? "");
  }, [open, providerGroups, selectedProvider?.id]);

  const activeProvider =
    filteredProviders.find((provider) => provider.id === activeProviderId) ??
    filteredProviders[0];

  const filteredModels = useMemo(() => {
    const keyword = normalize(modelSearch);
    if (!activeProvider) return [];
    if (!keyword) return activeProvider.models;

    return activeProvider.models.filter(
      (model) =>
        normalize(model.label).includes(keyword) ||
        normalize(model.value).includes(keyword),
    );
  }, [activeProvider, modelSearch]);

  const selectedLabel = selectedModel?.label ?? value;
  const selectedProviderIcon = selectedProvider?.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-left text-sm text-white/85 shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition-colors hover:border-white/18 hover:bg-white/[0.07] focus-visible:border-[#b43feb]/60 focus-visible:ring-2 focus-visible:ring-[#b43feb]/20 focus-visible:outline-none",
            triggerClassName,
          )}
        >
          <ProviderIcon icon={selectedProviderIcon} />
          <span className="min-w-0 flex-1 truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronDown
            size={15}
            className={cn(
              "shrink-0 text-white/45 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          "z-[90] w-[min(560px,calc(100vw-32px))] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101116] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.5)] ring-0",
          className,
        )}
      >
        <div className="grid h-[390px] grid-cols-[210px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col border-r border-white/8 bg-white/[0.025]">
            <div className="p-2.5">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 text-white/85 focus-within:border-[#b43feb]/50 focus-within:ring-2 focus-within:ring-[#b43feb]/15">
                <Search size={15} className="shrink-0 text-white/35" />
                <input
                  value={providerSearch}
                  onChange={(event) => setProviderSearch(event.target.value)}
                  placeholder="搜索模型..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
                />
              </label>
            </div>

            <div className="model-selector-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {filteredProviders.length === 0 ? (
                <div className="px-2 py-8 text-center text-xs text-white/40">
                  未找到供应商
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredProviders.map((provider) => {
                    const isActive = provider.id === activeProvider?.id;
                    const hasSelectedModel =
                      provider.id === selectedModel?.provider;

                    return (
                      <button
                        key={provider.id}
                        type="button"
                        className={cn(
                          "flex h-11 w-full items-center gap-2 rounded-xl px-2.5 text-left text-sm transition-colors",
                          isActive
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/[0.06] hover:text-white/90",
                        )}
                        onClick={() => {
                          setActiveProviderId(provider.id);
                          setModelSearch("");
                        }}
                      >
                        <ProviderIcon icon={provider.icon} />
                        <span className="min-w-0 flex-1 truncate">
                          {provider.label}
                        </span>
                        {hasSelectedModel && (
                          <Check size={15} className="shrink-0 text-[#d793ff]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col bg-[#121318]">
            <div className="border-b border-white/8 p-2.5">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-white/8 bg-black/25 px-3 text-white/85 focus-within:border-[#b43feb]/50 focus-within:ring-2 focus-within:ring-[#b43feb]/15">
                <Search size={15} className="shrink-0 text-white/35" />
                <input
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder={
                    activeProvider
                      ? `搜索 ${activeProvider.label} 模型...`
                      : "搜索模型..."
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
                />
              </label>
            </div>

            <div className="model-selector-scroll min-h-0 flex-1 overflow-y-auto p-2">
              {filteredModels.length === 0 ? (
                <div className="px-3 py-12 text-center text-sm text-white/40">
                  未找到模型
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredModels.map((model) => {
                    const isSelected = model.value === value;

                    return (
                      <button
                        key={model.value}
                        type="button"
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-[#b43feb]/18 text-white"
                            : "text-white/76 hover:bg-white/[0.06] hover:text-white",
                        )}
                        onClick={() => {
                          onChange(model.value);
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {model.label}
                        </span>
                        {isSelected && (
                          <Check size={16} className="shrink-0 text-[#d793ff]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
