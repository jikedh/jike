import { UnifiedVideoParamsPanel } from "./UnifiedVideoParamsPanel";

/**
 * 视频模型参数面板分发组件。
 * 根据模型类型渲染对应的参数面板。
 *
 * 注意：此组件已重构为使用 UnifiedVideoParamsPanel 统一面板，
 * 根据 model 参数动态渲染不同的参数控件。
 */
export const VideoModelParamsPanel = ({
  currentVideoData,
  onPatch,
}: {
  currentVideoData: any;
  onPatch: (patch: any) => void;
}) => {
  /** 当前视频模型 */
  const model = currentVideoData?.model ?? "doubao-seedance-2.0";

  // 使用统一参数面板，根据模型动态渲染
  return (
    <UnifiedVideoParamsPanel
      currentVideoData={currentVideoData}
      model={model}
      onPatch={onPatch}
    />
  );
};
