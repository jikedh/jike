import { useCallback, useEffect, useMemo, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";
import {
  BottomParamsBar,
  type VideoGenerateRequest,
} from "./components/BottomParamsBar";
import { ModeToggleBar } from "./components/ModeToggleBar";
import { PromptEditor } from "./components/PromptEditor";
import { ReferenceThumbnails } from "./components/ReferenceThumbnails";
import {
  type MentionItem,
  MOCK_MODELS,
  MOCK_REFERENCE_ITEMS,
} from "./constants/mockData";
import type { VideoModeKey } from "./constants/videoModelCapabilities";
import { ALL_MODE_KEYS } from "./constants/videoModelCapabilities";
import {
  normalizeVideoParams,
  type VideoParamState,
} from "./constants/videoParamConfigs";
import { useModeAvailability } from "./hooks/useModeAvailability";
import { buildVideoApiRequest } from "./utils/buildVideoApiRequest";

interface VideoPromptPanelProps {
  nodeId: string;
}

export const VideoPromptPanel = ({ nodeId }: VideoPromptPanelProps) => {
  const [activeMode, setActiveMode] = useState<VideoModeKey>("all-reference");
  const [selectedModel, setSelectedModel] = useState(MOCK_MODELS[0].value);
  const [referenceItems, setReferenceItems] =
    useState<MentionItem[]>(MOCK_REFERENCE_ITEMS);
  const [promptText, setPromptText] = useState("");
  const [selectedParams, setSelectedParams] = useState<VideoParamState>(() =>
    normalizeVideoParams(MOCK_MODELS[0].value),
  );
  const [selectedCount, setSelectedCount] = useState("1");

  const referenceImages = useMemo(
    () =>
      referenceItems
        .filter((item) => item.type === "image")
        .map((item) => item.thumbnail)
        .filter(Boolean),
    [referenceItems],
  );

  const handleSwapReferenceItems = useCallback(
    (indexA: number, indexB: number) => {
      setReferenceItems((prev) => {
        const nextItems = [...prev];
        [nextItems[indexA], nextItems[indexB]] = [
          nextItems[indexB],
          nextItems[indexA],
        ];
        return nextItems;
      });
    },
    [],
  );

  const referenceAllImages =
    referenceItems.length > 0 &&
    referenceItems.every((item) => item.type === "image");

  const { modeStates } = useModeAvailability({
    selectedModelId: selectedModel,
    referenceCount: referenceImages.length,
    hasAnyReference: referenceItems.length > 0,
    referenceAllImages,
  });

  const currentModeEnabled = useMemo(() => {
    const state = modeStates.find((mode) => mode.key === activeMode);
    return state?.enabled ?? false;
  }, [modeStates, activeMode]);

  const effectiveMode = useMemo(() => {
    if (currentModeEnabled) return activeMode;
    const firstEnabled = modeStates.find((mode) => mode.enabled);
    return firstEnabled?.key ?? ALL_MODE_KEYS[0];
  }, [currentModeEnabled, activeMode, modeStates]);

  useEffect(() => {
    if (effectiveMode !== activeMode) {
      setActiveMode(effectiveMode);
    }
  }, [effectiveMode, activeMode]);

  useEffect(() => {
    setSelectedParams((prev) =>
      normalizeVideoParams(selectedModel, prev, activeMode),
    );
  }, [selectedModel, activeMode]);

  const handleModeChange = useCallback(
    (mode: VideoModeKey) => {
      const state = modeStates.find((item) => item.key === mode);
      if (state?.enabled) {
        setActiveMode(mode);
      }
    },
    [modeStates],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);
      setReferenceItems((prev) =>
        modelId === "vidu" ? [] : prev.length > 0 ? prev : MOCK_REFERENCE_ITEMS,
      );
      setSelectedParams((prev) =>
        normalizeVideoParams(modelId, prev, activeMode),
      );
    },
    [activeMode],
  );

  const handleGenerate = useCallback((request: VideoGenerateRequest) => {
    const apiRequest = buildVideoApiRequest(request);
    // biome-ignore lint/suspicious/noConsole: This mock node must print the real request body before API wiring.
    console.log("Video generate API request:", apiRequest);
    // biome-ignore lint/suspicious/noConsole: Keep batch count visible without adding it to the API body.
    console.log("Video generate count:", Number(request.count));
  }, []);

  void nodeId;

  return (
    <TooltipProvider>
      <div className={PROMPT_PANEL_STYLES.container}>
        <ModeToggleBar
          modeStates={modeStates}
          activeMode={activeMode}
          onModeChange={(key) => handleModeChange(key as VideoModeKey)}
        />

        <ReferenceThumbnails
          items={referenceItems}
          onSwap={handleSwapReferenceItems}
        />

        <div className={PROMPT_PANEL_STYLES.textAreaWrap}>
          <PromptEditor
            mentionItems={referenceItems}
            onChange={setPromptText}
          />
        </div>

        <BottomParamsBar
          selectedModel={selectedModel}
          selectedParams={selectedParams}
          selectedCount={selectedCount}
          prompt={promptText}
          referenceItems={referenceItems}
          mode={activeMode}
          onModelChange={handleModelChange}
          onParamsChange={(params) =>
            setSelectedParams(
              normalizeVideoParams(selectedModel, params, activeMode),
            )
          }
          onCountChange={setSelectedCount}
          onGenerate={handleGenerate}
        />
      </div>
    </TooltipProvider>
  );
};
