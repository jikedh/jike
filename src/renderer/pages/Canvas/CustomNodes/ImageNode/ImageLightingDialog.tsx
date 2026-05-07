import {
  IconArrowUp,
  IconHelpCircle,
  IconPalette,
  IconRotateClockwise,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { uploadFileToOSS } from "service/oss";
import { IMAGE_MODELS } from "shared/constants/ai-models";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { cn } from "shared/utils/utils";
import { analyzeLightingReferenceImage } from "@/api/ai";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_LIGHTING_CONFIG,
  disposeLightingRenderer,
  getLightingConfigFromPoint,
  getLightingConfigForDirection,
  getLightingProjection,
  getLightingVector,
  getRimLightingConfigFromPoint,
  getRimLightingProjection,
  getRimLightingVector,
  LIGHTING_DIRECTION_LABELS,
  LIGHTING_PRESETS,
  type LightingConfig,
  type LightingDirection,
  type LightingGenerationConfig,
  loadLightingImage,
  renderLightingToCanvas,
} from "./utils/lighting";

type ImageLightingDialogProps = {
  open: boolean;
  imageUrl?: string;
  initialModel?: string;
  initialPlatform?: string;
  initialSize?: string;
  initialResolution?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: LightingGenerationConfig) => Promise<void>;
};

type ReferenceAnalysisStatus = "idle" | "uploading" | "analyzing" | "success" | "error";
type PreviewLightSource = "main" | "rim";

type SliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
};

const DIRECTION_OPTIONS: LightingDirection[] = [
  "left",
  "top",
  "right",
  "front",
  "bottom",
  "back",
];

const PERSPECTIVE_ROTATION_X = -30;
const PERSPECTIVE_ROTATION_Y = -30;
const PREVIEW_PERSPECTIVE = 420;
const LIGHTING_RENDER_THROTTLE_MS = 70;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const projectPreviewPoint = (
  localX: number,
  localY: number,
  rect: DOMRect,
  transformMatrix: DOMMatrixReadOnly,
) => {
  const originX = rect.width / 2;
  const originY = rect.height / 2;
  const point = new DOMPoint(
    localX - originX,
    localY - originY,
    0,
    1,
  ).matrixTransform(transformMatrix);
  const perspectiveW = Math.abs(point.w) > 0.001 ? point.w : 1;

  return {
    x: rect.left + originX + point.x / perspectiveW,
    y: rect.top + originY + point.y / perspectiveW,
  };
};

const solvePreviewLocalPoint = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  spaceElement: HTMLElement | null,
) => {
  const transform = spaceElement
    ? window.getComputedStyle(spaceElement).transform
    : "none";
  if (!transform || transform === "none") {
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  const matrix = new DOMMatrixReadOnly(transform);
  let localX = clamp(clientX - rect.left, 0, rect.width);
  let localY = clamp(clientY - rect.top, 0, rect.height);

  for (let index = 0; index < 8; index += 1) {
    const projected = projectPreviewPoint(localX, localY, rect, matrix);
    const errorX = projected.x - clientX;
    const errorY = projected.y - clientY;
    if (Math.hypot(errorX, errorY) < 0.05) {
      break;
    }

    const projectedX = projectPreviewPoint(localX + 1, localY, rect, matrix);
    const projectedY = projectPreviewPoint(localX, localY + 1, rect, matrix);
    const a = projectedX.x - projected.x;
    const b = projectedY.x - projected.x;
    const c = projectedX.y - projected.y;
    const d = projectedY.y - projected.y;
    const determinant = a * d - b * c;
    if (Math.abs(determinant) < 0.0001) {
      break;
    }

    const deltaX = (d * errorX - b * errorY) / determinant;
    const deltaY = (-c * errorX + a * errorY) / determinant;
    localX = clamp(localX - deltaX, 0, rect.width);
    localY = clamp(localY - deltaY, 0, rect.height);
  }

  return { x: localX, y: localY };
};

const getUnrotatedPointInPreview = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewMode: LightingConfig["viewMode"],
  spaceElement: HTMLElement | null,
) => {
  const localPoint =
    viewMode === "perspective"
      ? solvePreviewLocalPoint(clientX, clientY, rect, spaceElement)
      : {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };

  return {
    x: clamp(localPoint.x / rect.width, 0, 1),
    y: clamp(localPoint.y / rect.height, 0, 1),
  };
};

const SliderControl = ({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: SliderControlProps) => (
  <label className="grid gap-2">
    <span className="flex items-center justify-between text-sm text-white/78">
      <span>{label}</span>
      <span className="font-mono text-white/52">
        {value}
        {suffix}
      </span>
    </span>
    <div className="grid grid-cols-[1fr_84px] items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-white"
      />
      <div className="flex h-9 items-center justify-end gap-1 rounded-xl border border-white/8 bg-white/[0.035] px-3 text-sm text-white/45">
        <span className="font-mono text-white/58">{value}</span>
        <span>{suffix}</span>
      </div>
    </div>
  </label>
);

const getInitialModelId = (model?: string, platform?: string) => {
  const matched = IMAGE_MODELS.find(
    (item) => item.model === model && item.platform === platform,
  );
  if (matched) {
    return matched.id;
  }

  const modelOnly = IMAGE_MODELS.find((item) => item.model === model);
  if (modelOnly) {
    return modelOnly.id;
  }

  return (
    IMAGE_MODELS.find((item) => item.model === "doubao-seedream-5-0")?.id ??
    IMAGE_MODELS[0]?.id ??
    0
  );
};

const getReferenceStatusText = (status: ReferenceAnalysisStatus) => {
  if (status === "uploading") {
    return "上传中";
  }
  if (status === "analyzing") {
    return "分析中";
  }
  if (status === "success") {
    return "已分析";
  }
  if (status === "error") {
    return "分析失败";
  }
  return "打光参考图";
};

export const ImageLightingDialog = ({
  open,
  imageUrl,
  initialModel,
  initialPlatform,
  initialSize,
  initialResolution,
  onOpenChange,
  onConfirm,
}: ImageLightingDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewSphereRef = useRef<HTMLDivElement | null>(null);
  const previewSpaceRef = useRef<HTMLDivElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const renderedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const referenceAnalyzeControllerRef = useRef<AbortController | null>(null);
  const beamLengthUpdateAtRef = useRef(0);
  const beamLengthTimerRef = useRef<number | null>(null);
  const beamLengthTargetRef = useRef(0);
  const renderConfigTimerRef = useRef<number | null>(null);
  const renderConfigLatestRef = useRef<LightingConfig>(
    DEFAULT_LIGHTING_CONFIG,
  );
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [config, setConfig] = useState<LightingConfig>(
    DEFAULT_LIGHTING_CONFIG,
  );
  const [renderConfig, setRenderConfig] = useState<LightingConfig>(
    DEFAULT_LIGHTING_CONFIG,
  );
  const [smartMode, setSmartMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [referenceLightingPrompt, setReferenceLightingPrompt] = useState("");
  const [referenceStatus, setReferenceStatus] =
    useState<ReferenceAnalysisStatus>("idle");
  const [referenceError, setReferenceError] = useState("");
  const [isDraggingLight, setIsDraggingLight] = useState(false);
  const [beamLengthPercent, setBeamLengthPercent] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(() =>
    getInitialModelId(initialModel, initialPlatform),
  );
  const [selectedPresetId, setSelectedPresetId] = useState("custom");

  const resetState = useCallback(() => {
    referenceAnalyzeControllerRef.current?.abort();
    referenceAnalyzeControllerRef.current = null;
    setConfig(DEFAULT_LIGHTING_CONFIG);
    setSmartMode(false);
    setAiPrompt("");
    setReferenceImageUrl("");
    setReferenceLightingPrompt("");
    setReferenceStatus("idle");
    setReferenceError("");
    setSelectedModelId(getInitialModelId(initialModel, initialPlatform));
    setSelectedPresetId("custom");
  }, [initialModel, initialPlatform]);

  useEffect(() => {
    if (!open) {
      return;
    }

    resetState();
  }, [open, resetState]);

  useEffect(() => {
    if (!open || !imageUrl) {
      setPreviewImage(null);
      return;
    }

    let cancelled = false;
    setIsLoadingImage(true);
    setLoadError(null);
    setPreviewImage(null);

    loadLightingImage(imageUrl)
      .then((image) => {
        if (cancelled) {
          return;
        }
        setPreviewImage(image);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("灯光预览图片加载失败:", error);
        setLoadError("图片加载失败，无法进行本地灯光处理");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingImage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, open]);

  useEffect(() => {
    renderConfigLatestRef.current = config;

    if (!isDraggingLight) {
      if (renderConfigTimerRef.current !== null) {
        window.clearTimeout(renderConfigTimerRef.current);
        renderConfigTimerRef.current = null;
      }
      setRenderConfig(config);
      return;
    }

    if (renderConfigTimerRef.current !== null) {
      return;
    }

    renderConfigTimerRef.current = window.setTimeout(() => {
      renderConfigTimerRef.current = null;
      setRenderConfig(renderConfigLatestRef.current);
    }, LIGHTING_RENDER_THROTTLE_MS);
  }, [config, isDraggingLight]);

  useEffect(() => {
    if (!open || !canvasRef.current || !previewImage) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!canvasRef.current) {
        return;
      }

      try {
        renderedCanvasRef.current = canvasRef.current;
        renderLightingToCanvas(previewImage, renderConfig, canvasRef.current, {
          maxSide: 820,
          preserveSourceAspectRatio: true,
        });
      } catch (error) {
        console.error("灯光预览渲染失败:", error);
        setLoadError("灯光预览渲染失败");
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, previewImage, renderConfig]);

  useEffect(() => {
    if (open) {
      return;
    }

    if (renderedCanvasRef.current) {
      disposeLightingRenderer(renderedCanvasRef.current);
      renderedCanvasRef.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      referenceAnalyzeControllerRef.current?.abort();
      if (renderConfigTimerRef.current !== null) {
        window.clearTimeout(renderConfigTimerRef.current);
      }
      if (renderedCanvasRef.current) {
        disposeLightingRenderer(renderedCanvasRef.current);
      }
    },
    [],
  );

  const lightProjection = useMemo(() => getLightingProjection(config), [config]);
  const lightVector = useMemo(() => getLightingVector(config), [config]);
  const rimLightProjection = useMemo(
    () => getRimLightingProjection(config),
    [config],
  );
  const rimLightVector = useMemo(() => getRimLightingVector(config), [config]);
  const perspectiveLightPoint = useMemo(
    () => ({ x: lightProjection.x, y: lightProjection.y }),
    [lightProjection.x, lightProjection.y],
  );
  const displayLightPoint = perspectiveLightPoint;
  const rimLightPoint = useMemo(
    () => ({ x: rimLightProjection.x, y: rimLightProjection.y }),
    [rimLightProjection.x, rimLightProjection.y],
  );

  const previewAspectRatio = useMemo(() => {
    if (!previewImage?.naturalWidth || !previewImage?.naturalHeight) {
      return undefined;
    }

    return `${previewImage.naturalWidth} / ${previewImage.naturalHeight}`;
  }, [previewImage]);
  const beamAngle = useMemo(
    () =>
      Math.atan2(
        0.5 - displayLightPoint.y,
        0.5 - displayLightPoint.x,
      ) *
      (180 / Math.PI),
    [displayLightPoint.x, displayLightPoint.y],
  );
  const beamLengthTargetPercent = useMemo(
    () =>
      Math.hypot(
        0.5 - displayLightPoint.x,
        0.5 - displayLightPoint.y,
      ) * 100,
    [displayLightPoint.x, displayLightPoint.y],
  );
  const rimBeamAngle = useMemo(
    () =>
      Math.atan2(
        0.5 - rimLightPoint.y,
        0.5 - rimLightPoint.x,
      ) *
      (180 / Math.PI),
    [rimLightPoint.x, rimLightPoint.y],
  );
  const rimBeamLengthPercent = useMemo(
    () =>
      Math.hypot(
        0.5 - rimLightPoint.x,
        0.5 - rimLightPoint.y,
      ) * 100,
    [rimLightPoint.x, rimLightPoint.y],
  );
  const spaceRotationTransform =
    config.viewMode === "perspective"
      ? `perspective(${PREVIEW_PERSPECTIVE}px) rotateX(${PERSPECTIVE_ROTATION_X}deg) rotateY(${PERSPECTIVE_ROTATION_Y}deg)`
      : "perspective(420px) rotateX(0deg) rotateY(0deg)";
  const perspectiveSpaceStyle = useMemo(
    () => ({
      transform: spaceRotationTransform,
      transformOrigin: "50% 50%",
      transformStyle: "preserve-3d" as const,
    }),
    [spaceRotationTransform],
  );
  const previewImageTransform = "translate(-50%, -50%)";
  const isBackHemisphere = lightVector.z < -0.08;
  const isRimBackHemisphere = rimLightVector.z < -0.08;
  const lightMarkerScale = clamp(0.82 + Math.max(0, lightProjection.depth) * 0.28, 0.7, 1.12);
  const lightMarkerOpacity = clamp(0.58 + (lightProjection.depth + 1) * 0.2, 0.56, 1);
  const rimLightMarkerScale = clamp(0.72 + Math.max(0, rimLightProjection.depth) * 0.22, 0.66, 1);
  const rimLightMarkerOpacity = clamp(0.5 + (rimLightProjection.depth + 1) * 0.18, 0.5, 0.9);
  const lightColorGlow = `${config.color}66`;
  const lightColorWash = `${config.color}26`;
  const rimLightColor = "#dbe8ff";
  const rimLightColorGlow = `${rimLightColor}66`;
  const rimLightColorWash = `${rimLightColor}24`;
  const perspectiveImageStyle = useMemo(() => {
    const naturalWidth = previewImage?.naturalWidth;
    const naturalHeight = previewImage?.naturalHeight;
    if (!naturalWidth || !naturalHeight) {
      return undefined;
    }

    const maxWidth = 82;
    const maxHeight = 100;
    const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
    return {
      width: Math.max(1, Math.round(naturalWidth * scale)),
      height: Math.max(1, Math.round(naturalHeight * scale)),
    };
  }, [previewImage]);

  useEffect(() => {
    beamLengthTargetRef.current = beamLengthTargetPercent;

    const now = window.performance.now();
    const elapsed = now - beamLengthUpdateAtRef.current;

    const applyBeamLength = () => {
      beamLengthUpdateAtRef.current = window.performance.now();
      beamLengthTimerRef.current = null;
      setBeamLengthPercent(beamLengthTargetRef.current);
    };

    if (elapsed >= 70) {
      if (beamLengthTimerRef.current !== null) {
        window.clearTimeout(beamLengthTimerRef.current);
        beamLengthTimerRef.current = null;
      }
      applyBeamLength();
      return;
    }

    if (beamLengthTimerRef.current === null) {
      beamLengthTimerRef.current = window.setTimeout(
        applyBeamLength,
        70 - elapsed,
      );
    }
  }, [beamLengthTargetPercent]);

  useEffect(
    () => () => {
      if (beamLengthTimerRef.current !== null) {
        window.clearTimeout(beamLengthTimerRef.current);
      }
    },
    [],
  );

  const updateConfig = useCallback((patch: Partial<LightingConfig>) => {
    setConfig((current) => ({
      ...current,
      ...patch,
      presetId: patch.presetId ?? "custom",
    }));
  }, []);

  const getPreviewPointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const rect = previewSphereRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      return getUnrotatedPointInPreview(
        clientX,
        clientY,
        rect,
        config.viewMode,
        previewSpaceRef.current,
      );
    },
    [config.viewMode],
  );

  const getPreviewLightSourceFromClient = useCallback(
    (clientX: number, clientY: number): PreviewLightSource => {
      if (!config.rimLightEnabled) {
        return "main";
      }

      const point = getPreviewPointFromClient(clientX, clientY);
      if (!point) {
        return "main";
      }

      const mainDistance = Math.hypot(
        point.x - displayLightPoint.x,
        point.y - displayLightPoint.y,
      );
      const rimDistance = Math.hypot(
        point.x - rimLightPoint.x,
        point.y - rimLightPoint.y,
      );

      return rimDistance < mainDistance && rimDistance < 0.16 ? "rim" : "main";
    },
    [
      config.rimLightEnabled,
      displayLightPoint.x,
      displayLightPoint.y,
      getPreviewPointFromClient,
      rimLightPoint.x,
      rimLightPoint.y,
    ],
  );

  const updateLightPointFromClient = useCallback(
    (clientX: number, clientY: number, source: PreviewLightSource) => {
      const point = getPreviewPointFromClient(clientX, clientY);
      if (!point) {
        return;
      }

      setConfig((current) => {
        const next =
          source === "rim"
            ? getRimLightingConfigFromPoint(current, point)
            : getLightingConfigFromPoint(current, point);
        return {
          ...next,
          presetId: "custom",
        };
      });
    },
    [getPreviewPointFromClient],
  );

  const handlePreviewSpherePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDraggingLight(true);
      const source = getPreviewLightSourceFromClient(event.clientX, event.clientY);
      updateLightPointFromClient(event.clientX, event.clientY, source);
      const target = event.currentTarget;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateLightPointFromClient(moveEvent.clientX, moveEvent.clientY, source);
      };

      const stopDragging = () => {
        setIsDraggingLight(false);
        if (target.hasPointerCapture(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("pointercancel", stopDragging);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
    },
    [getPreviewLightSourceFromClient, updateLightPointFromClient],
  );

  const selectedModel = useMemo(
    () => IMAGE_MODELS.find((item) => item.id === selectedModelId),
    [selectedModelId],
  );

  const analyzeReferenceImage = useCallback(async (url: string) => {
    referenceAnalyzeControllerRef.current?.abort();
    const controller = new AbortController();
    referenceAnalyzeControllerRef.current = controller;
    setReferenceStatus("analyzing");
    setReferenceError("");

    try {
      const description = await analyzeLightingReferenceImage(
        url,
        controller.signal,
      );
      setReferenceLightingPrompt(description);
      setReferenceStatus("success");
    } catch (error: any) {
      if (controller.signal.aborted) {
        return;
      }
      console.error("参考图灯光分析失败:", error);
      setReferenceStatus("error");
      setReferenceError(error?.message || "参考图灯光分析失败");
    } finally {
      if (referenceAnalyzeControllerRef.current === controller) {
        referenceAnalyzeControllerRef.current = null;
      }
    }
  }, []);

  const handleRetryReferenceAnalysis = useCallback(() => {
    if (!referenceImageUrl || referenceStatus === "uploading") {
      return;
    }

    void analyzeReferenceImage(referenceImageUrl);
  }, [analyzeReferenceImage, referenceImageUrl, referenceStatus]);

  const handleReferenceFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setReferenceStatus("uploading");
      setReferenceError("");

      try {
        let fileToUpload = file;
        if (file.size > MAX_IMAGE_SIZE_MB) {
          fileToUpload = await compressImage(file);
        }

        const result = await uploadFileToOSS(fileToUpload);
        if (!result.url) {
          throw new Error("上传成功但未返回图片地址");
        }

        setReferenceImageUrl(result.url);
        setReferenceLightingPrompt("");
        void analyzeReferenceImage(result.url);
      } catch (error: any) {
        console.error("参考图上传失败:", error);
        setReferenceStatus("error");
        setReferenceError(error?.message || "参考图上传失败");
      } finally {
        event.target.value = "";
      }
    },
    [analyzeReferenceImage],
  );

  const handlePresetSelect = useCallback((presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = LIGHTING_PRESETS.find((item) => item.presetId === presetId);
    if (preset) {
      setAiPrompt(`${preset.name}风格：${preset.description}`);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (
      !imageUrl ||
      isSaving ||
      isLoadingImage ||
      loadError ||
      referenceStatus === "uploading" ||
      referenceStatus === "analyzing"
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const confirmPromise = onConfirm({
        ...config,
        presetId: smartMode ? selectedPresetId : "custom",
        smartMode,
        aiPrompt: smartMode ? aiPrompt.trim() : "",
        referenceImageUrl: smartMode ? referenceImageUrl : "",
        referenceLightingPrompt: smartMode
          ? referenceLightingPrompt.trim()
          : "",
        model: selectedModel?.model ?? initialModel ?? "doubao-seedream-5-0",
        platform: selectedModel?.platform ?? initialPlatform,
        size: initialSize ?? "1:1",
        resolution: initialResolution ?? "2K",
      });
      onOpenChange(false);
      await confirmPromise;
    } finally {
      setIsSaving(false);
    }
  }, [
    aiPrompt,
    config,
    imageUrl,
    initialModel,
    initialPlatform,
    initialResolution,
    initialSize,
    isLoadingImage,
    isSaving,
    loadError,
    onConfirm,
    onOpenChange,
    referenceImageUrl,
    referenceLightingPrompt,
    referenceStatus,
    selectedModelId,
    selectedPresetId,
    smartMode,
  ]);

  const canSave =
    Boolean(imageUrl) &&
    !isSaving &&
    !isLoadingImage &&
    !loadError &&
    referenceStatus !== "uploading" &&
    referenceStatus !== "analyzing";

  if (!open) {
    return null;
  }

  const content = (
    <div
      className="nodrag nopan nowheel fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(92,34,163,0.08)_0%,rgba(11,11,14,0.14)_28%,rgba(6,6,8,0.66)_100%)] backdrop-blur-[3px]"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_18%,rgba(0,0,0,0)_34%,rgba(0,0,0,0.2)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0)_100%)]" />
      <input
        ref={referenceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReferenceFileChange}
      />

      <div className="relative z-[90] mx-auto mt-6 flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-[#1f1f22]/95 px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={isSaving}
          onClick={() => {
            if (!isSaving) {
              onOpenChange(false);
            }
          }}
          title="关闭"
          aria-label="关闭"
        >
          <IconX size={18} />
        </button>

        <div className="h-8 w-px bg-white/10" />

        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={isSaving}
          onClick={resetState}
        >
          <IconRotateClockwise size={17} />
          重置参数
        </button>

        <Button
          type="button"
          size="sm"
          className="h-10 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
          loading={isSaving}
          disabled={!canSave}
          onClick={handleConfirm}
        >
          <span className="inline-flex items-center gap-1.5">
            <IconArrowUp size={17} stroke={2.4} />
            生成
          </span>
        </Button>
      </div>

      <div className="absolute inset-x-5 bottom-5 top-24 overflow-hidden rounded-2xl border border-white/10 bg-[#242424] shadow-[0_24px_90px_rgba(0,0,0,0.52)]">
        <header className="hidden">
          <h2 className="text-base font-semibold text-white">打光效果</h2>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white"
            disabled={isSaving}
            onClick={() => {
              if (!isSaving) {
                onOpenChange(false);
              }
            }}
            title="关闭"
            aria-label="关闭"
          >
            <IconX size={18} />
          </button>
        </header>

        <main className="grid h-full grid-cols-[270px_260px_minmax(330px,1fr)]">
          <section className="flex min-h-0 flex-col p-5 pr-4">
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-[#1c1c1c] p-5">
              <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-[#181818] p-1">
                {[
                  { value: "perspective", label: "透视" },
                  { value: "front", label: "正面" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={cn(
                      "h-10 rounded-xl text-sm font-semibold transition",
                      config.viewMode === item.value
                        ? "bg-white/[0.08] text-white"
                        : "text-white/38 hover:bg-white/[0.04] hover:text-white/70",
                    )}
                    onClick={() =>
                      updateConfig({
                        viewMode: item.value as LightingConfig["viewMode"],
                      })
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="relative mt-8 flex flex-1 items-center justify-center">
                {config.viewMode === "perspective" || config.viewMode === "front" ? (
                  <div
                    ref={previewSphereRef}
                    className={cn(
                      "relative size-52 select-none overflow-hidden rounded-full border border-white/8 bg-[radial-gradient(circle_at_34%_24%,rgba(255,255,255,0.2),rgba(255,255,255,0.05)_30%,rgba(0,0,0,0.18)_62%,rgba(0,0,0,0.36))] shadow-[inset_-24px_-28px_54px_rgba(0,0,0,0.48),inset_12px_10px_32px_rgba(255,255,255,0.06),0_20px_50px_rgba(0,0,0,0.28)]",
                      isDraggingLight ? "cursor-grabbing" : "cursor-grab",
                    )}
                    style={{ touchAction: "none" }}
                    onPointerDown={handlePreviewSpherePointerDown}
                  >
                    <div className="absolute inset-0 rounded-full bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_42%)]" />
                    <div
                      ref={previewSpaceRef}
                      className="pointer-events-none absolute inset-0 rounded-full transition-transform duration-300 ease-out"
                      style={perspectiveSpaceStyle}
                    >
                      <div className="absolute left-1/2 top-0 h-full w-px bg-white/[0.055]" />
                      <div className="absolute left-0 top-1/2 h-px w-full bg-white/[0.05]" />
                      <div className="absolute inset-5 rounded-full border border-white/[0.045]" />
                      <div className="absolute left-[13%] right-[13%] top-[49%] h-[30%] rounded-full border border-white/[0.055]" />
                      <div className="absolute left-[18%] right-[18%] top-[31%] h-[15%] rounded-full border border-white/[0.04]" />
                      {[-60, -28, 28, 60].map((longitudeAngle) => (
                        <div
                          key={longitudeAngle}
                          className="absolute inset-5 rounded-full border border-white/[0.04]"
                          style={{
                            transform: `rotateY(${longitudeAngle}deg)`,
                            transformStyle: "preserve-3d",
                          }}
                        />
                      ))}
                    <div
                      className={cn(
                        "pointer-events-none absolute h-11 origin-left rounded-full opacity-85",
                        !isDraggingLight && "transition-all duration-300 ease-out",
                      )}
                      style={{
                          left: `${displayLightPoint.x * 100}%`,
                          top: `${displayLightPoint.y * 100}%`,
                        width: `${beamLengthPercent}%`,
                        transform: `translate(0,-50%) rotate(${beamAngle}deg)`,
                        background: `linear-gradient(90deg, ${lightColorGlow}, rgba(255,255,255,0.16) 42%, transparent 100%)`,
                        clipPath: "polygon(0 48%, 100% 10%, 100% 90%)",
                        filter: "blur(0.4px)",
                        zIndex: isBackHemisphere ? 2 : 5,
                      }}
                    />
                    {config.rimLightEnabled ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute h-9 origin-left rounded-full opacity-75",
                          !isDraggingLight && "transition-all duration-300 ease-out",
                        )}
                        style={{
                          left: `${rimLightPoint.x * 100}%`,
                          top: `${rimLightPoint.y * 100}%`,
                          width: `${rimBeamLengthPercent}%`,
                          transform: `translate(0,-50%) rotate(${rimBeamAngle}deg)`,
                          background: `linear-gradient(90deg, ${rimLightColorGlow}, rgba(219,232,255,0.14) 44%, transparent 100%)`,
                          clipPath: "polygon(0 48%, 100% 18%, 100% 82%)",
                          filter: "blur(0.5px)",
                          zIndex: isRimBackHemisphere ? 2 : 5,
                        }}
                      />
                    ) : null}
                    <div
                      className={cn(
                        "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[0_0_18px_rgba(255,255,255,0.45)]",
                        isBackHemisphere
                          ? "border-dashed border-white/55"
                          : "border-black/80",
                        !isDraggingLight && "transition-all duration-300 ease-out",
                      )}
                      style={{
                          left: `${displayLightPoint.x * 100}%`,
                          top: `${displayLightPoint.y * 100}%`,
                        backgroundColor: config.color,
                        boxShadow: isBackHemisphere
                          ? `0 0 10px ${lightColorGlow}, inset 0 0 9px rgba(0,0,0,0.55)`
                          : `0 0 18px ${lightColorGlow}, 0 0 36px ${lightColorWash}`,
                        opacity: lightMarkerOpacity,
                        transform: "translate(0%, -0%)",
                        scale: lightMarkerScale,
                        zIndex: isBackHemisphere ? 2 : 6,
                      }}
                    />
                    {config.rimLightEnabled ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute size-3.5 rounded-full border shadow-[0_0_16px_rgba(219,232,255,0.45)]",
                          isRimBackHemisphere
                            ? "border-dashed border-sky-100/55"
                            : "border-sky-100/80",
                          !isDraggingLight && "transition-all duration-300 ease-out",
                        )}
                        style={{
                          left: `${rimLightPoint.x * 100}%`,
                          top: `${rimLightPoint.y * 100}%`,
                          backgroundColor: rimLightColor,
                          boxShadow: isRimBackHemisphere
                            ? `0 0 10px ${rimLightColorGlow}, inset 0 0 8px rgba(0,0,0,0.52)`
                            : `0 0 16px ${rimLightColorGlow}, 0 0 30px ${rimLightColorWash}`,
                          opacity: rimLightMarkerOpacity,
                          transform: "translate(-50%, -50%)",
                          scale: rimLightMarkerScale,
                          zIndex: isRimBackHemisphere ? 2 : 6,
                        }}
                      />
                    ) : null}
                    <div className="absolute left-1/2 top-[66%] h-6 w-20 -translate-x-1/2 rounded-full bg-black/38 blur-[6px]" />
                    {imageUrl ? (
                      <div
                        className="absolute left-1/2 top-1/2 flex items-center justify-center overflow-hidden rounded-sm border border-white/16 bg-black/20 shadow-[10px_14px_28px_rgba(0,0,0,0.42)] transition-transform duration-300 ease-out"
                        style={{
                          ...perspectiveImageStyle,
                          transform: previewImageTransform,
                          transformOrigin: "50% 50%",
                          transformStyle: "preserve-3d",
                          zIndex: 4,
                        }}
                      >
                        {isLoadingImage ? null : (
                          <canvas
                            ref={canvasRef}
                            className="block h-full w-full scale-[1.18]"
                          />
                        )}
                      </div>
                    ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.045] bg-[#151515] p-5">
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at ${displayLightPoint.x * 100}% ${displayLightPoint.y * 100}%, ${lightColorWash} 0%, transparent 46%), linear-gradient(${beamAngle + 90}deg, rgba(255,255,255,0.09), transparent 58%)`,
                      }}
                    />
                    <div className="pointer-events-none absolute inset-x-5 top-1/2 h-px bg-white/[0.05]" />
                    <div className="pointer-events-none absolute left-1/2 inset-y-5 w-px bg-white/[0.05]" />
                    <div
                      className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/70"
                      style={{
                        left: `${displayLightPoint.x * 100}%`,
                        top: `${displayLightPoint.y * 100}%`,
                        backgroundColor: config.color,
                        boxShadow: `0 0 18px ${lightColorGlow}`,
                      }}
                    />
                    {imageUrl ? (
                      <div
                        className="relative max-h-[250px] w-full overflow-hidden rounded-lg border border-white/12 bg-black/35 shadow-[0_18px_42px_rgba(0,0,0,0.38)]"
                        style={
                          previewAspectRatio
                            ? { aspectRatio: previewAspectRatio }
                            : undefined
                        }
                      >
                        {isLoadingImage ? null : (
                          <canvas
                            ref={canvasRef}
                            className="block h-full w-full object-contain"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-white/46">暂无可处理图片</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="min-h-0 border-r border-white/[0.035] p-5 pl-0">
            <div className="flex h-full flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">全局</h3>
                <label className="flex items-center gap-2 text-sm text-white/42">
                  <span>智能模式</span>
                  <button
                    type="button"
                    aria-pressed={smartMode}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition",
                      smartMode ? "bg-white/88" : "bg-white/18",
                    )}
                    onClick={() => setSmartMode((prev) => !prev)}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-[#242424] transition",
                        smartMode ? "left-[18px]" : "left-0.5 bg-white/90",
                      )}
                    />
                  </button>
                </label>
              </div>

              <SliderControl
                label="亮度"
                value={config.intensity}
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => updateConfig({ intensity: value })}
              />

              <label className="grid gap-2">
                <span className="flex items-center gap-1.5 text-sm text-white/78">
                  颜色
                  <IconHelpCircle size={13} className="text-white/28" />
                </span>
                <div className="flex h-10 items-center gap-3">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(event) =>
                      updateConfig({ color: event.target.value })
                    }
                    className="h-8 w-15 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="灯光颜色"
                  />
                  <IconPalette size={16} className="text-white/35" />
                  <span className="font-mono text-xs text-white/42">
                    {config.color.toUpperCase()}
                  </span>
                </div>
              </label>

              <div className="grid gap-3">
                <span className="text-sm text-white/78">主光源</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {DIRECTION_OPTIONS.map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      className={cn(
                        "h-10 rounded-xl border text-sm font-semibold transition",
                        config.lightDirection === direction
                          ? "border-white/28 bg-white/12 text-white"
                          : "border-white/7 bg-white/[0.025] text-white/44 hover:bg-white/[0.06] hover:text-white/76",
                      )}
                      onClick={() =>
                        setConfig((current) =>
                          getLightingConfigForDirection(current, direction),
                        )
                      }
                    >
                      {LIGHTING_DIRECTION_LABELS[direction]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                aria-pressed={config.rimLightEnabled}
                className="mt-1 flex items-center justify-between text-sm text-white/78"
                onClick={() =>
                  updateConfig({ rimLightEnabled: !config.rimLightEnabled })
                }
              >
                <span className="flex items-center gap-1.5">
                  轮廓光
                  <IconHelpCircle size={13} className="text-white/28" />
                </span>
                <span
                  className={cn(
                    "relative h-5 w-9 rounded-full transition",
                    config.rimLightEnabled ? "bg-white/88" : "bg-white/18",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full transition",
                      config.rimLightEnabled
                        ? "left-[18px] bg-[#242424]"
                        : "left-0.5 bg-white/90",
                    )}
                  />
                </span>
              </button>
            </div>
          </section>

          <section className="min-h-0 p-5">
            <div className={cn("grid gap-4", !smartMode && "opacity-45")}>
              <div className="flex h-10 items-center justify-between">
                <h3 className="text-base font-semibold text-white/82">
                  智能模式
                </h3>
                <Select
                  value={String(selectedModelId)}
                  onValueChange={(value) => setSelectedModelId(Number(value))}
                >
                  <SelectTrigger className="h-9 w-42 rounded-xl border-white/8 bg-white/[0.035] text-xs text-white/72">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent className="z-[230] border-white/10 bg-[#252528] text-white">
                    {IMAGE_MODELS.map((item) => (
                      <SelectItem
                        key={item.id}
                        value={String(item.id)}
                        className="text-white focus:bg-white/[0.08] focus:text-white"
                      >
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[1fr_70px] gap-2">
                <Textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  disabled={!smartMode}
                  placeholder="简单描述你想实现的打光效果，或者情绪风格"
                  className="min-h-24 resize-none rounded-xl border-white/8 bg-white/[0.025] text-sm text-white placeholder:text-white/36 focus-visible:ring-white/18 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-white/8 bg-white/[0.025] px-2 text-center text-sm text-white/54 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!smartMode || referenceStatus === "uploading" || referenceStatus === "analyzing"}
                  onClick={() => referenceInputRef.current?.click()}
                >
                  {referenceImageUrl ? (
                    <img
                      src={referenceImageUrl}
                      alt="打光参考图"
                      className="mb-1 size-9 rounded-md object-cover"
                    />
                  ) : (
                    <IconUpload size={22} className="mb-1 text-white/45" />
                  )}
                  <span>{getReferenceStatusText(referenceStatus)}</span>
                </button>
              </div>

              {referenceError ? (
                <p className="text-xs text-red-300/80">{referenceError}</p>
              ) : null}

              {referenceImageUrl || referenceLightingPrompt ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-xs text-white/52">
                    <span>参考图灯光描述</span>
                    <button
                      type="button"
                      className="text-white/46 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={
                        !smartMode ||
                        !referenceImageUrl ||
                        referenceStatus === "uploading" ||
                        referenceStatus === "analyzing"
                      }
                      onClick={handleRetryReferenceAnalysis}
                    >
                      重新分析
                    </button>
                  </div>
                  <Textarea
                    value={referenceLightingPrompt}
                    onChange={(event) =>
                      setReferenceLightingPrompt(event.target.value)
                    }
                    disabled={!smartMode || !referenceImageUrl}
                    placeholder={
                      referenceStatus === "analyzing"
                        ? "正在分析参考图灯光..."
                        : "上传参考图后，这里会生成可编辑的灯光描述"
                    }
                    className="min-h-20 resize-none rounded-xl border-white/8 bg-white/[0.025] text-sm text-white placeholder:text-white/30 focus-visible:ring-white/18 disabled:cursor-not-allowed"
                  />
                </div>
              ) : null}

              <div className="grid gap-3">
                <span className="text-sm text-white/60">预设</span>
                <div className="grid grid-cols-4 gap-3">
                  {LIGHTING_PRESETS.map((preset, index) => {
                    const active = preset.presetId === selectedPresetId;
                    return (
                      <button
                        key={preset.presetId}
                        type="button"
                        disabled={!smartMode}
                        className={cn(
                          "group relative aspect-[1.15] overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed",
                          active
                            ? "border-white/50"
                            : "border-white/7 hover:border-white/22",
                        )}
                        onClick={() => handlePresetSelect(preset.presetId)}
                      >
                        <div
                          className={cn(
                            "absolute inset-0",
                            [
                              "bg-[radial-gradient(circle_at_36%_25%,#fff7df_0%,#ad7a45_36%,#2b211e_100%)]",
                              "bg-[radial-gradient(circle_at_70%_22%,#61c7ff_0%,#12304f_45%,#07090d_100%)]",
                              "bg-[radial-gradient(circle_at_25%_22%,#ffd39a_0%,#5c3320_42%,#0d0a08_100%)]",
                              "bg-[radial-gradient(circle_at_75%_28%,#20f0ff_0%,#9333ea_45%,#090711_100%)]",
                              "bg-[radial-gradient(circle_at_78%_35%,#ff9b5f_0%,#d74b2f_42%,#09120f_100%)]",
                              "bg-[radial-gradient(circle_at_40%_18%,#9db7ff_0%,#141a2d_50%,#07070a_100%)]",
                              "bg-[radial-gradient(circle_at_30%_28%,#ffcf72_0%,#9e6526_45%,#19100b_100%)]",
                              "bg-[radial-gradient(circle_at_50%_20%,#d7dde6_0%,#4c5663_50%,#0c0d10_100%)]",
                            ][index],
                          )}
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/72 via-black/12 to-transparent" />
                        <span className="absolute bottom-2 left-2 right-2 text-sm font-semibold text-white drop-shadow">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="hidden">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-white/58 transition hover:text-white"
            onClick={resetState}
          >
            <IconRotateClockwise size={18} />
            重置参数
          </button>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-sm text-white/66">
            </div>
            <Button
              type="button"
              size="sm"
              className="size-10 rounded-xl bg-[#c9c9c9] p-0 text-black hover:bg-white"
              loading={isSaving}
              disabled={!canSave}
              onClick={handleConfirm}
              aria-label="生成"
            >
              <IconArrowUp size={24} stroke={2.4} />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
