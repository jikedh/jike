import { useCallback, useEffect, useMemo, useState } from "react";

import { GenerationStatus } from "shared/constants/enum";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
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
  VIDEO_MODEL_OPTIONS,
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

const buildReferenceItems = (
  imageUrls: string[] = [],
  videoUrls: string[] = [],
  audioUrls: string[] = [],
): MentionItem[] => [
    ...imageUrls.map((url, index) => ({
      id: `image-${index}-${url}`,
      label: `图片${index + 1}`,
      value: url,
      thumbnail: url,
      type: "image" as const,
    })),
    ...videoUrls.map((url, index) => ({
      id: `video-${index}-${url}`,
      label: `视频${index + 1}`,
      value: url,
      thumbnail: url,
      type: "video" as const,
    })),
    ...audioUrls.map((url, index) => ({
      id: `audio-${index}-${url}`,
      label: `音频${index + 1}`,
      value: url,
      thumbnail: url,
      type: "audio" as const,
    })),
  ];

export const VideoPromptPanel = ({ nodeId }: VideoPromptPanelProps) => {
  const currentData = useCanvasFlowStore(
    (state) => state.nodes.find((node) => node.id === nodeId)?.data,
  );
  const startNewVideoGeneration = useCanvasFlowStore(
    (state) => state.startNewVideoGeneration,
  );
  const [activeMode, setActiveMode] = useState<VideoModeKey>("all-reference");
  const [selectedModel, setSelectedModel] = useState(
    currentData?.model ?? VIDEO_MODEL_OPTIONS[0].value,
  );
  const [promptText, setPromptText] = useState(
    currentData?.promptDraft ?? currentData?.prompt ?? "",
  );
  const [selectedParams, setSelectedParams] = useState<VideoParamState>(() =>
    normalizeVideoParams(currentData?.model ?? VIDEO_MODEL_OPTIONS[0].value),
  );
  const [selectedCount, setSelectedCount] = useState("1");

  const referenceItems = useMemo(
    () =>
      buildReferenceItems(
        currentData?.image_urls,
        currentData?.video_urls,
        currentData?.audio_urls,
      ),
    [currentData?.image_urls, currentData?.video_urls, currentData?.audio_urls],
  );

  const referenceImages = useMemo(
    () =>
      referenceItems
        .filter((item) => item.type === "image")
        .map((item) => item.thumbnail)
        .filter(Boolean),
    [referenceItems],
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
      setSelectedParams((prev) =>
        normalizeVideoParams(modelId, prev, activeMode),
      );
    },
    [activeMode],
  );

  const handleGenerate = useCallback(
    (request: VideoGenerateRequest) => {
      const apiRequest = buildVideoApiRequest(request);
      void startNewVideoGeneration(nodeId, {
        ...apiRequest,
        __newVideoInput: request,
      }, Number(request.count));
    },
    [nodeId, startNewVideoGeneration],
  );

  const isGenerating =
    currentData?.status === GenerationStatus.QUEUED ||
    currentData?.status === GenerationStatus.IN_PROGRESS;

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
          disabled={isGenerating}
        />
      </div>
    </TooltipProvider>
  );
};
