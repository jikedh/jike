import {
  type Viewport,
  useReactFlow
} from "@xyflow/react";
import {
  Icon3dRotate,
  IconBrush,
  IconCrop,
  IconDownload,
  IconEraser,
  IconLamp,
  IconTrash,
  IconUpload,
  IconZoomIn
} from "@tabler/icons-react";
import type { ChangeEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import {
  NANO_BANANA_LOCAL_MODEL,
  NANO_BANANA_LOCAL_PLATFORM
} from "shared/constants/ai-models";
import type { ImageGenerationNode } from "shared/types/flow";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { appendMediaSequences } from "shared/utils/mediaSequence";
import { getAspectRatioFromMediaFile } from "./utils/aspectRatioUtils";
import { cn, downloadImageFromUrl } from "shared/utils/utils";
import { toast } from "sonner";
import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Share from "yet-another-react-lightbox/plugins/share";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { withRemoteMediaRef } from "../utils/localMedia";
import { ImageCropDialog } from "./ImageCropDialog";
import { ImageLightingDialog } from "./ImageLightingDialog";
import { InpaintDialog } from "./InpaintDialog";
import {
  buildLightingPrompt,
  type LightingGenerationConfig
} from "./utils/lighting";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

type ImageToolbarProps = {
  nodeId: string;
  data: ImageGenerationNode;
  onDelete?: () => void;
  onCrop?: (file: File, cropRatio: string) => Promise<void>;
  onAnnotate?: () => void;
  onErase?: () => void;
  onLighting?: () => void;
  isUploading?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  isLightingGenerating?: boolean;
};

type ActionKey =
  | "upload"
  | "erase"
  | "annotate"
  | "enhance"
  | "outpaint"
  | "crop"
  | "lighting"
  | "download"
  | "preview"
  | "panorama";

/**
 * 图片节点工具栏组件
 */
export const ImageToolbar = memo(
  ({
    nodeId,
    data,
    onDelete,
    onCrop,
    onAnnotate,
    onErase,
    onLighting,
    isUploading = false,
    onUploadingChange,
    isLightingGenerating: isExternalLightingGenerating = false,
  }: ImageToolbarProps) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
    const [isLightingDialogOpen, setIsLightingDialogOpen] = useState(false);
    const [isLightingGenerating, setIsLightingGenerating] = useState(false);
    const [isInpaintDialogOpen, setIsInpaintDialogOpen] = useState(false);
    const [isInpaintGenerating, setIsInpaintGenerating] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previousLightingViewportRef = useRef<Viewport | null>(null);
    const reactFlowInstance = useReactFlow();
    const reactFlowInstanceRef = useRef(reactFlowInstance);
    reactFlowInstanceRef.current = reactFlowInstance;

    const updateImageNodeData = useCanvasFlowStore(
      (state) => state.updateImageNodeData,
    );
    const projectId = useCanvasFlowStore((state) => state.projectId);
    const startImageGeneration = useCanvasFlowStore(
      (state) => state.startImageGeneration,
    );
    const startGeminiPro2Generation = useCanvasFlowStore(
      (state) => state.startGeminiPro2Generation,
    );
    const addNode = useCanvasFlowStore((state) => state.addNode);
    const onConnect = useCanvasFlowStore((state) => state.onConnect);
    const openPanoramaViewer = useCanvasFlowStore(
      (state) => state.openPanoramaViewer,
    );
    const setDefaultImagePreset = useChatSettingsStore(
      (state) => state.setDefaultImagePreset,
    );

    const imageUrls = data.result?.data?.map((item) => item.url) ?? [];
    const currentImageUrl = imageUrls[0];

    const restoreLightingViewport = useCallback(() => {
      const previousViewport = previousLightingViewportRef.current;
      previousLightingViewportRef.current = null;

      if (previousViewport) {
        reactFlowInstanceRef.current.setViewport(previousViewport, {
          duration: 260,
        });
      }
    }, []);

    const focusLightingSourceNode = useCallback(() => {
      const sourceNode = useCanvasFlowStore
        .getState()
        .nodes.find((node) => node.id === nodeId);
      if (!sourceNode) {
        return;
      }

      if (!previousLightingViewportRef.current) {
        previousLightingViewportRef.current =
          reactFlowInstanceRef.current.getViewport();
      }

      void reactFlowInstanceRef.current.fitView({
        nodes: [{ id: sourceNode.id }],
        padding: 0.18,
        duration: 280,
      });
    }, [nodeId]);

    const handleLightingDialogOpenChange = useCallback(
      (open: boolean) => {
        if (open && isLightingGenerating) {
          return;
        }

        if (open) {
          focusLightingSourceNode();
        } else {
          restoreLightingViewport();
        }

        setIsLightingDialogOpen(open);
      },
      [
        focusLightingSourceNode,
        isLightingGenerating,
        restoreLightingViewport,
      ],
    );

    useEffect(() => {
      return () => {
        restoreLightingViewport();
      };
    }, [restoreLightingViewport]);

    const toolbarActions = useMemo(() => {
      return [
        { key: "upload" as const, label: "上传", icon: IconUpload },
        { key: "erase" as const, label: "擦除", icon: IconEraser },
        { key: "annotate" as const, label: "标注", icon: IconBrush },
        { key: "crop" as const, label: "裁剪", icon: IconCrop },
        { key: "lighting" as const, label: "灯光", icon: IconLamp },
        { key: "download" as const, label: "下载", icon: IconDownload },
        { key: "preview" as const, label: "放大", icon: IconZoomIn },
        { key: "panorama" as const, label: "全景", icon: Icon3dRotate },
      ];
    }, []);

    const handleUploadClick = () => {
      if (isUploading) return;
      fileInputRef.current?.click();
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      onUploadingChange?.(true);

      try {
        // 检查文件大小，大于10MB时压缩
        let fileToUpload = file;
        if (file.size > MAX_IMAGE_SIZE_MB) {
          fileToUpload = await compressImage(file);
        }

        const result = await uploadFileToOSS(fileToUpload);
        const uploadedUrl = result.url;

        if (!uploadedUrl) {
          toast.warning("上传成功但未返回图片地址");
          return;
        }

        const currentData = data.result?.data ?? [];
        const resultItem = withRemoteMediaRef({
          url: uploadedUrl,
          remoteUrl: uploadedUrl,
        });

        // 检测图片尺寸并更新节点比例（仅当节点还没有图片时设置 size）
        const updatePatch: Record<string, any> = {
          result: {
            type: "image",
            data: appendMediaSequences(currentData, [resultItem]),
          },
        };

        if (currentData.length === 0) {
          const aspectRatio = await getAspectRatioFromMediaFile(
            fileToUpload,
            "image",
          );
          if (aspectRatio) {
            updatePatch.size = aspectRatio;
          }
        }

        updateImageNodeData(nodeId, updatePatch);
        toast.success("上传成功");
      } catch (uploadError) {
        console.error("上传图片失败:", uploadError);
        toast.error("上传失败，请重试");
      } finally {
        onUploadingChange?.(false);
        event.target.value = "";
      }
    };

    const handleAction = async (actionKey: ActionKey) => {
      if (actionKey === "upload") {
        handleUploadClick();
        return;
      }

      if (actionKey === "erase") {
        if (!currentImageUrl) {
          toast.info("暂无可重绘图片");
          return;
        }

        onErase?.();
        return;
      }

      if (actionKey === "annotate") {
        if (!currentImageUrl) {
          toast.info("暂无可标注图片");
          return;
        }

        onAnnotate?.();
        return;
      }

      if (actionKey === "crop") {
        if (!currentImageUrl) {
          toast.info("暂无可裁剪图片");
          return;
        }

        setIsCropDialogOpen(true);
        return;
      }

      if (actionKey === "lighting") {
        if (!currentImageUrl) {
          toast.info("暂无可调光图片");
          return;
        }

        onLighting?.();
        return;
      }

      if (actionKey === "download") {
        if (!currentImageUrl) {
          toast.info("暂无可下载图片");
          return;
        }
        if (isDownloading) return;

        setIsDownloading(true);
        try {
          await downloadImageFromUrl(currentImageUrl);
          toast.success("下载成功");
        } catch (error) {
          const message = error instanceof Error ? error.message : "下载失败";
          toast.error(message);
        } finally {
          setIsDownloading(false);
        }
        return;
      }

      if (actionKey === "preview") {
        if (!currentImageUrl) {
          toast.info("暂无可预览图片");
          return;
        }
        setIsLightboxOpen(true);
        return;
      }

      if (actionKey === "panorama") {
        if (!currentImageUrl) {
          toast.info("暂无可查看图片");
          return;
        }

        // 打开全景图查看器，并把当前节点 ID 一起传过去，便于后续创建子节点
        openPanoramaViewer(currentImageUrl, nodeId);
        return;
      }

      toast.info("功能开发中...");
    };

    const handleLightingGenerate = async (config: LightingGenerationConfig) => {
      if (!currentImageUrl) {
        toast.info("暂无可调光图片");
        throw new Error("暂无可调光图片");
      }

      setIsLightingGenerating(true);

      try {
        const sourceNode = useCanvasFlowStore
          .getState()
          .nodes.find((node) => node.id === nodeId);
        if (!sourceNode || sourceNode.type !== "imageNode") {
          throw new Error("当前图片节点不存在");
        }

        const childPosition = {
          x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
          y: sourceNode.position.y,
        };
        const childId = addNode("image", childPosition);
        if (!childId) {
          throw new Error("灯光图片节点创建失败");
        }

        onConnect({
          source: nodeId,
          target: childId,
          sourceHandle: "output",
          targetHandle: "input",
        });

        const isNiji7Model = config.model === "midjourney-niji7";
        const isMidjourneyModel =
          config.model === "midjourney" || isNiji7Model;
        const isNanoBananaLocalModel =
          config.model === NANO_BANANA_LOCAL_MODEL &&
          config.platform === NANO_BANANA_LOCAL_PLATFORM;
        const isLocalDirectModel =
          isNanoBananaLocalModel;
        const backendModel = isNiji7Model ? "midjourney" : config.model;
        const size = config.size ?? data.size ?? "1:1";
        const resolution = config.resolution ?? data.resolution ?? "2K";
        const prompt = buildLightingPrompt(config);
        let finalPrompt = prompt;

        if (isMidjourneyModel && !finalPrompt.includes("--ar")) {
          finalPrompt = `${finalPrompt} --ar ${size}`;
          if (isNiji7Model) {
            finalPrompt = `${finalPrompt} --niji 7`;
          }
        }

        const payload = {
          model: backendModel,
          originalModel: config.model,
          platform: config.platform,
          prompt: finalPrompt,
          resolution,
          n: 1,
          image_urls: [currentImageUrl],
          promptDraft: config.aiPrompt ?? "",
          promptDraftHtml: `<p>${config.aiPrompt ?? ""}</p>`,
          size,
          metadata: { resolution },
          lighting: config,
          ...(isMidjourneyModel
            ? {
              aspectRatio: data.aspectRatio ?? "1:1",
              midjourneyAdvanced: data.midjourneyAdvanced,
            }
            : {}),
        };

        updateImageNodeData(childId, {
          badgeLabel: "灯光",
          model: config.model,
          originalModel: config.model,
          platform: config.platform,
          prompt: finalPrompt,
          promptDraft: config.aiPrompt ?? "",
          promptDraftHtml: `<p>${config.aiPrompt ?? ""}</p>`,
          image_urls: [currentImageUrl],
          size,
          resolution,
          result: {
            type: "image",
            data: [],
          },
          lighting: config,
        });

        setDefaultImagePreset({
          model: config.model,
          platform: config.platform,
          size,
          resolution,
        });

        if (isLocalDirectModel) {
          await startGeminiPro2Generation(childId, payload);
        } else {
          await startImageGeneration(childId, payload);
        }

        toast.success("已开始灯光重绘生成");
      } catch (error: any) {
        console.error("灯光处理失败:", error);
        toast.error(error?.message || "灯光处理失败，请重试");
        throw error;
      } finally {
        setIsLightingGenerating(false);
      }
    };

    const handleInpaintGenerate = async ({
      file,
      prompt,
    }: {
      file: File;
      prompt: string;
    }) => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        toast.warning("请输入提示词");
        return;
      }

      const suffix =
        "修复 mask 区域，使其和周围环境自然融合，保留图像原有风格。";
      const finalPrompt = `${trimmedPrompt} ${suffix}`;

      setIsInpaintGenerating(true);

      try {
        // 检查文件大小，大于10MB时压缩
        let fileToUpload = file;
        if (file.size > MAX_IMAGE_SIZE_MB) {
          fileToUpload = await compressImage(file);
        }

        const uploadResult = await uploadFileToOSS(fileToUpload);
        const inpaintImageUrl = uploadResult.url;

        if (!inpaintImageUrl) {
          toast.warning("上传成功但未返回图片地址");
          return;
        }

        const sourceNode = useCanvasFlowStore
          .getState()
          .nodes.find((node) => node.id === nodeId);
        if (!sourceNode || sourceNode.type !== "imageNode") {
          toast.error("当前图片节点不存在");
          return;
        }

        const childPosition = {
          x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
          y: sourceNode.position.y,
        };

        const childId = addNode("image", childPosition);

        onConnect({
          source: nodeId,
          target: childId,
          sourceHandle: "output",
          targetHandle: "input",
        });

        updateImageNodeData(childId, {
          badgeLabel: "擦除",
        });

        // 固定豆包 Seedream，重绘场景走 image_urls 单图输入。
        await startImageGeneration(childId, {
          model: "doubao-seedream-5-0",
          prompt: finalPrompt,
          image_urls: [inpaintImageUrl],
        });

        toast.success("已开始重绘生成");
      } catch (error: any) {
        console.error("重绘生成失败:", error);
        toast.error(error?.message || "重绘生成失败，请重试");
        throw error;
      } finally {
        setIsInpaintGenerating(false);
      }
    };

    const isPreviewActive = isLightboxOpen;

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="nodrag nopan nowheel inline-flex h-10  items-center gap-2  rounded-full border border-white/10 bg-[#2a2a2d]/95 px-1.5 shadow-xl backdrop-blur-sm">
          {toolbarActions.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === "preview" ? isPreviewActive : false;
            const isDisabled =
              (item.key === "download" && isDownloading) ||
              (item.key === "upload" && isUploading) ||
              (item.key === "lighting" &&
                (isLightingGenerating || isExternalLightingGenerating)) ||
              ((item.key === "crop" || item.key === "lighting") &&
                !currentImageUrl);
            const title =
              item.key === "lighting"
                ? "调节当前节点光影布光"
                : item.label;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleAction(item.key)}
                disabled={isDisabled}
                className={cn(
                  "flex flex-col items-center gap-0.5 whitespace-nowrap px-2 py-1.5 rounded-lg text-xs leading-none transition-colors cursor-pointer",
                  isDisabled
                    ? "text-white/30 cursor-not-allowed"
                    : isActive
                      ? "text-[#B43FEB]"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                )}
                title={title}
                aria-label={item.label}
              >
                <Icon size={16} stroke={1.5} />
                <span className="text-[10px] leading-none">{item.label}</span>
              </button>
            );
          })}

          {/* 分隔线 */}
          <div className="w-px h-6 bg-white/10 mx-0.5" />

          {/* 删除按钮 */}
          <button
            type="button"
            onClick={onDelete}
            className="flex flex-col items-center gap-0.5 whitespace-nowrap px-2 py-1.5 rounded-lg text-xs leading-none text-white/60 transition-colors cursor-pointer hover:text-red-400 hover:bg-red-500/10"
            title="删除"
            aria-label="删除节点"
          >
            <IconTrash size={16} stroke={1.5} />
            <span className="text-[10px] leading-none">删除</span>
          </button>
        </div>

        {isLightboxOpen ? (
          <Lightbox
            open={isLightboxOpen}
            close={() => setIsLightboxOpen(false)}
            slides={imageUrls
              .filter((url): url is string => !!url)
              .map((url) => ({ src: url }))}
            plugins={[Fullscreen, Slideshow, Zoom, Share, Download]}
            zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 2 }}
            controller={{ closeOnBackdropClick: true }}
          />
        ) : null}

        <ImageCropDialog
          open={isCropDialogOpen}
          imageUrl={currentImageUrl}
          onOpenChange={setIsCropDialogOpen}
          onConfirm={async (file, cropRatio) => {
            if (!onCrop) {
              toast.info("裁剪功能暂不可用");
              return;
            }

            await onCrop(file, cropRatio);
          }}
        />

        <ImageLightingDialog
          open={isLightingDialogOpen}
          imageUrl={currentImageUrl}
          initialModel={data.model}
          initialPlatform={data.platform}
          initialSize={data.size}
          initialResolution={data.resolution}
          onOpenChange={handleLightingDialogOpenChange}
          onConfirm={handleLightingGenerate}
        />

        <InpaintDialog
          open={isInpaintDialogOpen}
          imageUrl={currentImageUrl}
          onOpenChange={(open) => {
            if (isInpaintGenerating) {
              return;
            }

            setIsInpaintDialogOpen(open);
          }}
          onGenerate={handleInpaintGenerate}
        />
      </>
    );
  },
);

ImageToolbar.displayName = "ImageToolbar";
