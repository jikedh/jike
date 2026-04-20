import { clampSeedance20Duration } from "shared/utils/utils";
import { Seedance20ParamsPanel } from "./Seedance20ParamsPanel";

/**
 * 视频模型参数面板分发组件。
 * 使用映射表组合模型和参数面板，减少容器层条件分支长度。
 */
export const VideoModelParamsPanel = ({
  currentVideoData,
  aspectRatio,
  seedance20Metadata,
  onPatch,
}: {
  currentVideoData: any;
  aspectRatio: string;
  seedance20Metadata: any;
  onPatch: (patch: any) => void;
}) => {
  return (
    <Seedance20ParamsPanel
      mode={(seedance20Metadata.mode as "fast" | "pro" | undefined) ?? "fast"}
      duration={currentVideoData?.duration}
      aspectRatio={aspectRatio}
      resolution={
        (seedance20Metadata.resolution as "480p" | "720p" | undefined) ?? "720p"
      }
      generateAudio={seedance20Metadata.generate_audio}
      onModeChange={(value) => {
        const nextDuration = clampSeedance20Duration(
          currentVideoData?.duration ?? 8,
          value,
        );
        onPatch({
          duration: nextDuration,
          metadata: {
            ...seedance20Metadata,
            mode: value,
          },
        });
      }}
      onDurationChange={(value) => {
        const currentMode = (currentVideoData?.metadata?.mode ?? "fast") as
          | "fast"
          | "pro";
        onPatch({
          duration: clampSeedance20Duration(value, currentMode),
        });
      }}
      onAspectRatioChange={(value) => onPatch({ aspect_ratio: value })}
      onResolutionChange={(value) => {
        onPatch({
          metadata: {
            ...seedance20Metadata,
            resolution: value,
          },
        });
      }}
      onGenerateAudioChange={(value) => {
        onPatch({
          metadata: {
            ...seedance20Metadata,
            generate_audio: value,
          },
        });
      }}
    />
  );
};
