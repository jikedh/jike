import { clampSeedance20Duration } from "shared/utils/utils";
import { Seedance20ParamsPanel } from "./Seedance20ParamsPanel";
import { Wan27I2vParamsPanel } from "./Wan27I2vParamsPanel";

/**
 * 视频模型参数面板分发组件。
 * 根据模型类型渲染对应的参数面板。
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
  const model = currentVideoData?.model ?? "doubao-seedance-2.0";

  // Wan 2.7 I2V 参数面板
  if (model === "wan2.7-i2v") {
    return (
      <Wan27I2vParamsPanel
        duration={currentVideoData?.duration}
        resolution={
          (currentVideoData?.metadata?.resolution as "720P" | "1080P" | undefined) ??
          "720P"
        }
        onDurationChange={(value) => {
          onPatch({ duration: value });
        }}
        onResolutionChange={(value) => {
          onPatch({
            metadata: {
              ...(currentVideoData?.metadata ?? {}),
              resolution: value,
            },
          });
        }}
      />
    );
  }

  // Doubao Seedance 2.0 参数面板（默认）
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
