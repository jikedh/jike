import { IconPlayerPlay } from "@tabler/icons-react";

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
  VIDEO_COUNT_OPTIONS,
  VIDEO_MODEL_OPTIONS,
} from "../constants/mockData";
import type { VideoModeKey } from "../constants/videoModelCapabilities";
import type { VideoParamState } from "../constants/videoParamConfigs";
import { VideoParamsPopover } from "./VideoParamsPopover";

// UI 层请求体（捕获面板状态）
export interface VideoGenerateRequest {
  model: string;
  params: VideoParamState;
  count: string;
  prompt: string;
  referenceItems: MentionItem[];
  mode: VideoModeKey;
}

interface BottomParamsBarProps {
  selectedModel: string;
  selectedParams: VideoParamState;
  selectedCount: string;
  prompt: string;
  referenceItems: MentionItem[];
  mode: VideoModeKey;
  onModelChange: (value: string) => void;
  onParamsChange: (value: VideoParamState) => void;
  onCountChange: (value: string) => void;
  onGenerate: (request: VideoGenerateRequest) => void;
  disabled?: boolean;
}

export const BottomParamsBar = ({
  selectedModel,
  selectedParams,
  selectedCount,
  prompt,
  referenceItems,
  mode,
  onModelChange,
  onParamsChange,
  onCountChange,
  onGenerate,
  disabled = false,
}: BottomParamsBarProps) => {
  const handleClick = () => {
    const request: VideoGenerateRequest = {
      model: selectedModel,
      params: selectedParams,
      count: selectedCount,
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
            {VIDEO_MODEL_OPTIONS.map((model) => (
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

        <Select value={selectedCount} onValueChange={onCountChange}>
          <SelectTrigger size="sm" className={PROMPT_PANEL_STYLES.countButton}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
            {VIDEO_COUNT_OPTIONS.map((count) => (
              <SelectItem
                key={count}
                value={String(count)}
                className={PROMPT_PANEL_STYLES.modelSelectItem}
              >
                {count}个
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="blue"
          size="sm"
          onClick={handleClick}
          disabled={disabled}
          className="px-7 py-2.5 rounded-xl text-sm font-bold"
        >
          <IconPlayerPlay size={16} />
        </Button>
      </div>
    </div>
  );
};
