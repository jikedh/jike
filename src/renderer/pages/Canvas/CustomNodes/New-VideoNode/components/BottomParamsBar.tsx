import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PROMPT_PANEL_STYLES } from "../../shared/promptPanelStyles";
import {
  type MentionItem,
  type ModelOption,
  VIDEO_MODEL_OPTIONS,
} from "../constants/mockData";
import type { VideoModeKey } from "../constants/videoModelCapabilities";
import type { VideoParamState } from "../constants/videoParamConfigs";
import { VideoParamsPopover } from "./VideoParamsPopover";

// UI 层请求体（捕获面板状态）
export interface VideoGenerateRequest {
  model: string;
  params: VideoParamState;
  prompt: string;
  referenceItems: MentionItem[];
  mode: VideoModeKey;
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
  disabled?: boolean;
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
  disabled = false,
  accessory,
  modelOptions = VIDEO_MODEL_OPTIONS,
}: BottomParamsBarProps) => {
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
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger size="sm" className={PROMPT_PANEL_STYLES.modelSelect}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
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
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {accessory}
        {isGenerating ? (
          <Button
            unstyled
            onClick={onStop}
            disabled
            className={PROMPT_PANEL_STYLES.stopButton}
          >
            停止
          </Button>
        ) : (
          <Button
            unstyled
            onClick={handleClick}
            disabled={disabled}
            className={PROMPT_PANEL_STYLES.generateButton}
          >
            生成
          </Button>
        )}
      </div>
    </div>
  );
};
