import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "shared/utils/utils";

import { PROMPT_PANEL_STYLES } from "../../shared/promptPanelStyles";
import {
  type MentionItem,
  type ModelOption,
  VIDEO_MODEL_OPTIONS
} from "../constants/mockData";
import type { VideoModeKey } from "../constants/videoModelCapabilities";
import type { VideoParamState } from "../constants/videoParamConfigs";
import { VideoModelHelpTooltip } from "./VideoModelHelpTooltip";
import { VideoParamsPopover } from "./VideoParamsPopover";

// UI 层请求体（捕获面板状态）
export interface VideoGenerateRequest {
  model: string;
  params: VideoParamState;
  prompt: string;
  referenceItems: MentionItem[];
  mode: VideoModeKey;
  /** Wan2.7 全能参考专用：视觉素材 URL 到参考音色 URL 的映射。 */
  wanReferenceVoiceByUrl?: Record<string, string>;
}

interface BottomParamsBarProps {
  selectedModel: string;
  selectedParams: VideoParamState;
  prompt: string;
  referenceItems: MentionItem[];
  mode: VideoModeKey;
  onModelChange: (value: string) => void;
  onParamsChange: (value: VideoParamState) => void;
  onGenerate: (request: VideoGenerateRequest) => void;
  onStop?: () => void;
  isGenerating?: boolean;
  canStop?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  accessory?: ReactNode;
  modelOptions?: ModelOption[];
}

export const BottomParamsBar = ({
  selectedModel,
  selectedParams,
  prompt,
  referenceItems,
  mode,
  onModelChange,
  onParamsChange,
  onGenerate,
  onStop,
  isGenerating = false,
  canStop = false,
  disabled = false,
  disabledReason,
  accessory,
  modelOptions = VIDEO_MODEL_OPTIONS,
}: BottomParamsBarProps) => {
  const wanReferenceDurationMax =
    selectedModel === "wanxiang" &&
      mode === "all-reference" &&
      referenceItems.some((item) => item.type === "video")
      ? 10
      : undefined;

  const handleClick = () => {
    const request: VideoGenerateRequest = {
      model: selectedModel,
      params: selectedParams,
      prompt,
      referenceItems,
      mode,
    };
    onGenerate(request);
  };

  return (
    <div className={PROMPT_PANEL_STYLES.controlArea}>
      <div className="flex items-center gap-2">
        <VideoModelHelpTooltip modelId={selectedModel} />
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger size="sm" className={PROMPT_PANEL_STYLES.modelSelect}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            className={cn(
              PROMPT_PANEL_STYLES.modelSelectContent,
              "z-10000",
            )}
          >
            {modelOptions.map((model) => (
              <SelectItem
                key={model.value}
                value={model.value}
                className={PROMPT_PANEL_STYLES.modelSelectItem}
              >
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <VideoParamsPopover
          modelId={selectedModel}
          mode={mode}
          value={selectedParams}
          onChange={onParamsChange}
          durationMaxOverride={wanReferenceDurationMax}
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {accessory}
        {isGenerating ? (
          <Button
            unstyled
            onClick={onStop}
            aria-disabled={!canStop}
            className={PROMPT_PANEL_STYLES.stopButton}
          >
            停止
          </Button>
        ) : (
          <Button
            unstyled
            onClick={handleClick}
            aria-disabled={disabled}
            title={disabledReason}
            className={PROMPT_PANEL_STYLES.generateButton}
          >
            生成
          </Button>
        )}
      </div>
    </div>
  );
};
