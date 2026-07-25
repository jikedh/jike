import {
  IconDownload,
  IconPhotoPlus,
  IconPencil,
  IconTable,
  IconUser,
} from "@tabler/icons-react";
import { type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { generateVideoSnapshotUrl, uploadFileToOSS } from "service/oss";
import {
  AGNES_IMAGE_2_FLASH_MODEL,
  AGNES_IMAGE_21_FLASH_MODEL,
  AGNES_PLATFORM,
  IMAGE_MODELS,
  isAgnesImageModel,
} from "shared/constants/ai-models";
import { getImageGenerationPoints } from "shared/constants/model-points";
import { VIDEO_PULL_FILM_COLUMNS } from "shared/constants/video-agent-presets";
import type { CharacterTableRow, TableNodeType } from "shared/types/flow";
import { cn, downloadImageFromUrl } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";
import { useMessage } from "@/hooks/useMessage";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { requestCanvasDeleteConfirm } from "@/pages/Canvas/utils/deleteConfirm";
import {
  cacheStoryboardImageToProject,
  getStoryboardImageCacheKey,
  type StoryboardImageCacheMap,
} from "@/services/storyboardImageCache";
import { exportVideoPullFilmExcel } from "@/services/tableExcelExport";
import { generateTableStoryboardImage } from "@/services/tableStoryboardImageGeneration";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { getPrimaryRemoteVideoUrlFromNodeData } from "../New-VideoNode/utils/video-url";
import { NodeNameBadge } from "../shared/NodeNameBadge";
import Lightbox, { type LightboxProps } from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Share from "yet-another-react-lightbox/plugins/share";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

const TABLE_COLUMNS = [
  "姓名",
  "基础设定",
  "性格特征",
  "核心动机",
  "核心关系",
  "习惯和兴趣",
];

const STORYBOARD_IMAGE_COLUMN = "分镜图";
const STORYBOARD_SKETCH_COLUMN = "分镜草图";
const STORYBOARD_ACTION_COLUMN = "操作";
const STORYBOARD_CAPTURE_CONCURRENCY = 6;
const STORYBOARD_SKETCH_CONCURRENCY = 4;
const STORYBOARD_SKETCH_MODEL = AGNES_IMAGE_2_FLASH_MODEL;
const STORYBOARD_SKETCH_PLATFORM = AGNES_PLATFORM;
const STORYBOARD_SKETCH_SIZE = "16:9";
const STORYBOARD_SKETCH_RESOLUTION = "1K";
const STORYBOARD_SKETCH_RETRY_LIMIT = 2;
const COMMON_IMAGE_SIZE_OPTIONS = [
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
];
const WIDE_IMAGE_SIZE_OPTIONS = [
  ...COMMON_IMAGE_SIZE_OPTIONS,
  { label: "3:2", value: "3:2" },
  { label: "2:3", value: "2:3" },
  { label: "21:9", value: "21:9" },
  { label: "9:21", value: "9:21" },
];
const IMAGE_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K" },
  { label: "2K", value: "2K" },
  { label: "4K", value: "4K" },
];
const AGNES_IMAGE_RESOLUTION_OPTIONS = [{ label: "1K", value: "1K" }];
const AGNES_IMAGE_21_SIZE_OPTIONS = [
  ...COMMON_IMAGE_SIZE_OPTIONS,
  { label: "2:3", value: "2:3" },
  { label: "3:2", value: "3:2" },
  { label: "21:9", value: "21:9" },
];
const AGNES_IMAGE_21_RESOLUTION_OPTIONS = [
  { label: "1K", value: "1K" },
  { label: "2K", value: "2K" },
  { label: "3K", value: "3K" },
  { label: "4K", value: "4K" },
];
const STORYBOARD_SELECT_CONTENT_CLASS =
  "!z-[10001] border border-white/10 bg-[#141418] text-white shadow-2xl ring-white/10";
const STORYBOARD_SELECT_ITEM_CLASS =
  "text-white focus:bg-white/10 focus:text-white data-[state=checked]:text-[#B43FEB] data-[state=checked]:focus:text-[#B43FEB]";
const DEFAULT_STORYBOARD_SKETCH_PROMPT_TEMPLATE = [
  "请只根据输入的分镜图参考图生成一张影视分镜草图。",
  "必须保持参考图中的构图、主体位置、人物姿态、镜头角度、景别、动作方向、明暗关系和画幅比例。",
  "草图风格：黑白或灰阶导演分镜线稿，清晰轮廓，保留必要的光影层次，适合拍摄执行参考。",
  "不要生成信息表格、分镜信息栏、字幕、台词、说明文字、水印、UI、画中画或分屏。",
  "不要根据任何表格文字或分镜字段补充画面内容；画面内容只来自输入的分镜图。",
].join("\n");
const LEGACY_STORYBOARD_SKETCH_PROMPT_MARKERS = [
  "{{storyboard_table}}",
  "分镜草图卡片",
  "信息表格区",
  "下方表格",
] as const;
const CHARACTER_PROFILE_DISPLAY_FIELDS = [
  { label: "别名", keys: ["aliases", "别名", "称呼"] },
  { label: "样貌", keys: ["appearance", "样貌", "外貌", "长相"] },
  { label: "穿着", keys: ["outfit", "穿着", "服装", "衣着"] },
  { label: "道具", keys: ["accessories", "道具", "饰品", "配饰"] },
  {
    label: "明显特征",
    keys: ["distinctiveFeatures", "明显特征", "特征", "标志"],
  },
  {
    label: "一致性提示",
    keys: ["consistencyPrompt", "一致性提示", "一致性", "保持"],
  },
] as const;

const isImageSource = (value?: string) =>
  Boolean(
    value &&
    (/^https?:\/\//i.test(value) ||
      value.startsWith("data:image/") ||
      value.startsWith("blob:")),
  );

const isStoryboardMediaColumn = (column: string) =>
  column === STORYBOARD_IMAGE_COLUMN || column === STORYBOARD_SKETCH_COLUMN;

const isStoryboardActionColumn = (column: string) =>
  column === STORYBOARD_ACTION_COLUMN;

const getStoryboardDownloadFilename = (imageUrl: string) => {
  try {
    const url = new URL(imageUrl);
    const filename = url.pathname.split("/").pop();
    if (filename && filename.includes(".")) {
      return filename;
    }
  } catch {
  }

  return `storyboard-${Date.now()}.jpg`;
};

type StoryboardCaptureRow = {
  row: Record<string, unknown>;
  rowIndex: number;
  captureTimeMs: number;
};

type StoryboardSketchRow = {
  rowIndex: number;
  referenceImageUrl: string;
};

type GenerateStoryboardSketchWithRetryOptions = {
  rowIndex: number;
  referenceImageUrl: string;
  signal: AbortSignal;
};

type SourceVideoInfo = {
  videoUrl: string;
  videoNodeId?: string;
};

const getVideoUrlFromNode = (node: any) =>
  String(getPrimaryRemoteVideoUrlFromNodeData(node?.data) ?? "").trim();

const parseTimeTokenToSeconds = (token: string) => {
  const normalized = token.trim().replace(/：/g, ":");
  if (!normalized) return null;

  const secondsMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:秒|s)$/i);
  if (secondsMatch) {
    return Number(secondsMatch[1]);
  }

  const parts = normalized.split(":");
  if (parts.length === 2 || parts.length === 3) {
    const numbers = parts.map((part) => Number(part));
    if (numbers.some((value) => Number.isNaN(value))) return null;

    if (numbers.length === 2) {
      const [minutes, seconds] = numbers;
      return minutes * 60 + seconds;
    }

    const [hours, minutes, seconds] = numbers;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
};

const parseStoryboardCaptureTimeMs = (value: unknown) => {
  const text = String(value ?? "")
    .replace(/：/g, ":")
    .trim();
  if (!text) return null;

  const timeTokens =
    text.match(/\d{1,2}:\d{1,2}(?::\d{1,2})?(?:\.\d+)?/g) ??
    text.match(/\d+(?:\.\d+)?\s*(?:秒|s)/gi) ??
    [];
  const seconds = timeTokens
    .map(parseTimeTokenToSeconds)
    .filter((time): time is number => time != null && time >= 0);

  if (seconds.length >= 2) {
    const [start, end] = seconds;
    const captureTime = end >= start ? (start + end) / 2 : start;
    return Math.round(captureTime * 1000);
  }

  if (seconds.length === 1) {
    return Math.round(seconds[0] * 1000);
  }

  return null;
};

const ensureColumnAfter = (
  columns: string[],
  column: string,
  afterColumn: string,
) => {
  if (columns.includes(column)) return columns;
  const afterIndex = columns.indexOf(afterColumn);
  if (afterIndex < 0) return [...columns, column];
  return [
    ...columns.slice(0, afterIndex + 1),
    column,
    ...columns.slice(afterIndex + 1),
  ];
};

const ensureStoryboardColumns = (columns: string[]) =>
  ensureColumnAfter(
    ensureColumnAfter(columns, STORYBOARD_IMAGE_COLUMN, "转场"),
    STORYBOARD_SKETCH_COLUMN,
    STORYBOARD_IMAGE_COLUMN,
  );

const getDisplayColumns = (columns: string[], showActions: boolean) => {
  const dataColumns = columns.filter(
    (column) => column !== STORYBOARD_ACTION_COLUMN,
  );
  return showActions ? [...dataColumns, STORYBOARD_ACTION_COLUMN] : dataColumns;
};

const orderVideoPullFilmColumns = (columns: string[]) => {
  const uniqueColumns = Array.from(new Set(columns));
  const orderedColumns = VIDEO_PULL_FILM_COLUMNS.filter((column) =>
    uniqueColumns.includes(column),
  );
  const extraColumns = uniqueColumns.filter(
    (column) => !(VIDEO_PULL_FILM_COLUMNS as readonly string[]).includes(column),
  );
  return [...orderedColumns, ...extraColumns];
};

const buildStoryboardSketchPrompt = (
  template = DEFAULT_STORYBOARD_SKETCH_PROMPT_TEMPLATE,
) => {
  const promptTemplate =
    template.trim() || DEFAULT_STORYBOARD_SKETCH_PROMPT_TEMPLATE;
  if (
    LEGACY_STORYBOARD_SKETCH_PROMPT_MARKERS.some((marker) =>
      promptTemplate.includes(marker),
    )
  ) {
    return DEFAULT_STORYBOARD_SKETCH_PROMPT_TEMPLATE;
  }
  return promptTemplate;
};

const isAbortGenerationError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const getGenerationErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "生成失败";

const getDefaultStoryboardSketchModel = () =>
  IMAGE_MODELS.find((model) => model.model === STORYBOARD_SKETCH_MODEL) ??
  IMAGE_MODELS[0];

const getSketchModelOption = (model: string, platform?: string) =>
  IMAGE_MODELS.find(
    (item) => item.model === model && item.platform === platform,
  ) ??
  IMAGE_MODELS.find((item) => item.model === model) ??
  getDefaultStoryboardSketchModel();

const stringifyProfileValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join("、");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value ?? "").trim();
};

const getProfileValue = (
  profile: Record<string, unknown>,
  keys: readonly string[],
) => {
  for (const key of keys) {
    const value = stringifyProfileValue(profile[key]);
    if (value) return value;
  }
  return "";
};

const getCharacterProfileTitle = (profile: unknown, index: number) => {
  if (profile && typeof profile === "object") {
    const item = profile as Record<string, unknown>;
    const name = stringifyProfileValue(
      item.name ?? item.角色 ?? item.姓名 ?? item.人物 ?? item.主体,
    );
    if (name) return name;
  }
  return `角色 ${index + 1}`;
};

const getCharacterProfileKey = (profile: unknown, index: number) => {
  if (profile && typeof profile === "object") {
    const item = profile as Record<string, unknown>;
    const id = stringifyProfileValue(item.id ?? item.name ?? item.角色);
    if (id) return `${id}-${index}`;
  }
  return `profile-${index}`;
};

const getCharacterProfileDetails = (profile: unknown) => {
  if (!profile || typeof profile !== "object") {
    const value = stringifyProfileValue(profile);
    return value ? [{ label: "内容", value }] : [];
  }

  const item = profile as Record<string, unknown>;
  const details = CHARACTER_PROFILE_DISPLAY_FIELDS.map(({ label, keys }) => ({
    label,
    value: getProfileValue(item, keys),
  })).filter(({ value }) => Boolean(value));

  if (details.length > 0) return details;

  const raw = stringifyProfileValue(item.raw);
  if (raw) return [{ label: "原始描述", value: raw }];

  return Object.entries(item)
    .filter(([key]) => !["id", "name", "角色", "姓名"].includes(key))
    .map(([key, value]) => ({
      label: key,
      value: stringifyProfileValue(value),
    }))
    .filter(({ value }) => Boolean(value));
};

const FullscreenIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
    <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
    <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
    <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
  </svg>
);

const MinimizeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3v3a2 2 0 0 1-2 2H3"></path>
    <path d="M21 8h-3a2 2 0 0 1-2-2V3"></path>
    <path d="M3 16h3a2 2 0 0 1 2 2v3"></path>
    <path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
  </svg>
);

const DeleteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18"></path>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
  </svg>
);

interface EditableCellProps {
  value: string;
  rowIndex: number;
  column: string;
  onUpdate: (rowIndex: number, column: string, value: string) => void;
  onPreviewImage?: (url: string) => void;
  maxWidth?: string;
  className?: string;
}

const EditableCell = memo(
  ({
    value,
    rowIndex,
    column,
    onUpdate,
    onPreviewImage,
    maxWidth,
    className,
  }: EditableCellProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
        setEditValue(value);
      },
      [value],
    );

    const handleBlur = useCallback(() => {
      setIsEditing(false);
      if (editValue !== value) {
        onUpdate(rowIndex, column, editValue);
      }
    }, [editValue, value, rowIndex, column, onUpdate]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleBlur();
        }
        if (e.key === "Escape") {
          setEditValue(value);
          setIsEditing(false);
        }
      },
      [handleBlur, value],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditValue(e.target.value);
      },
      [],
    );

    if (isStoryboardMediaColumn(column) && !isEditing) {
      if (isImageSource(value)) {
        return (
          <button
            type="button"
            className="flex h-[84px] w-[148px] items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/20 cursor-zoom-in"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewImage?.(value);
            }}
            title="预览图片"
          >
            <img
              src={value}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          </button>
        );
      }

      return (
        <div
          className={cn(
            "whitespace-pre-wrap break-words leading-relaxed cursor-text w-full h-full",
            className,
          )}
          style={{ maxWidth: maxWidth || "120px" }}
          onDoubleClick={handleDoubleClick}
        >
          {value || "-"}
        </div>
      );
    }

    if (isEditing) {
      return (
        <textarea
          value={editValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="absolute inset-0 w-full h-full bg-[#1A1A1C] text-[#8D8D8E] text-xs resize-none outline-none border border-[#B43FEB]/50 leading-relaxed p-3 nodrag nopan noflow nowheel"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <div
        className={cn(
          "whitespace-pre-wrap break-words leading-relaxed cursor-text w-full h-full",
          className,
        )}
        style={{ maxWidth: maxWidth || "120px" }}
        onDoubleClick={handleDoubleClick}
      >
        {value || "-"}
      </div>
    );
  },
);

EditableCell.displayName = "EditableCell";

interface TableBodyProps {
  rows: CharacterTableRow[];
  columns: string[];
  onUpdateCell: (rowIndex: number, column: string, value: string) => void;
  onPreviewImage?: (url: string) => void;
  onGenerateStoryboardSketch?: (rowIndex: number) => void;
  storyboardActionDisabled?: boolean;
  storyboardSketchingRowIndex?: number | null;
  maxWidth?: string;
  cellClassName?: string;
}

const TableBody = memo(
  ({
    rows,
    columns,
    onUpdateCell,
    onPreviewImage,
    onGenerateStoryboardSketch,
    storyboardActionDisabled,
    storyboardSketchingRowIndex,
    maxWidth,
    cellClassName,
  }: TableBodyProps) => {
    if (!rows || rows.length === 0) {
      return (
        <tr>
          <td
            colSpan={columns.length}
            className={cn(
              "px-3 py-8 text-center text-[#8D8D8E]/50 text-xs",
              cellClassName,
            )}
          >
            暂无数据
          </td>
        </tr>
      );
    }

    return (
      <>
        {rows.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className="hover:bg-white/[0.03] transition-colors"
          >
            {columns.map((col) => {
              const isActionColumn = isStoryboardActionColumn(col);
              const hasSketch = isImageSource(
                String(row[STORYBOARD_SKETCH_COLUMN] ?? "").trim(),
              );
              const isSketchingThisRow =
                storyboardSketchingRowIndex === rowIndex;

              return (
                <td
                  key={col}
                  className={cn(
                    "relative px-3 py-2 border-b border-r border-white/[0.06] text-[#8D8D8E] text-xs align-top",
                    isActionColumn && "text-center align-middle whitespace-nowrap",
                    cellClassName,
                  )}
                >
                  {isActionColumn ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onGenerateStoryboardSketch?.(rowIndex);
                      }}
                      disabled={storyboardActionDisabled}
                      className="rounded-md border border-[#B43FEB]/70 bg-[#B43FEB] px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:border-[#c45bff] hover:bg-[#c45bff] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isSketchingThisRow
                        ? "生成中..."
                        : hasSketch
                          ? "重新生成分镜草图"
                          : "生成分镜草图"}
                    </button>
                  ) : (
                    <EditableCell
                      value={row[col as keyof typeof row] || ""}
                      rowIndex={rowIndex}
                      column={col}
                      onUpdate={onUpdateCell}
                      onPreviewImage={onPreviewImage}
                      maxWidth={maxWidth}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </>
    );
  },
);

TableBody.displayName = "TableBody";

export const TableNode = memo(
  ({
    id,
    data,
    selected,
    width,
    height,
    dragging,
  }: NodeProps<TableNodeType>) => {
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const projectId = useCanvasFlowStore((state) => state.projectId);
    const updateTableNodeData = useCanvasFlowStore(
      (state) => state.updateTableNodeData,
    );
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );
    const isDragging = Boolean(dragging);
    // 仅订阅与当前节点相关的派生布尔值，避免选中数量变化时所有节点重渲染
    const hasMultipleSelected = useCanvasFlowStore(
      (state) => state.selectedNodesCount > 1,
    );
    const shouldShowToolbar = selected && !isDragging && !hasMultipleSelected;
    const {
      totalPoints,
      fallbackAIGenPrice,
      normalizeRequiredPoints,
      validateBalanceBeforeGenerate,
      refreshBalanceInfo,
    } = useGenerationPoints();
    const { warning, error, success } = useMessage();

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [characterProfilesDialogOpen, setCharacterProfilesDialogOpen] =
      useState(false);
    const defaultStoryboardSketchModel = useMemo(
      () => getDefaultStoryboardSketchModel(),
      [],
    );
    const [storyboardSketchDialogOpen, setStoryboardSketchDialogOpen] =
      useState(false);
    const [storyboardSketchModel, setStoryboardSketchModel] = useState(
      defaultStoryboardSketchModel.model,
    );
    const [storyboardSketchPlatform, setStoryboardSketchPlatform] = useState(
      defaultStoryboardSketchModel.platform,
    );
    const [storyboardSketchSize, setStoryboardSketchSize] = useState(
      STORYBOARD_SKETCH_SIZE,
    );
    const [storyboardSketchResolution, setStoryboardSketchResolution] =
      useState(STORYBOARD_SKETCH_RESOLUTION);
    const [storyboardSketchPromptTemplate, setStoryboardSketchPromptTemplate] =
      useState(DEFAULT_STORYBOARD_SKETCH_PROMPT_TEMPLATE);
    const [storyboardGenerating, setStoryboardGenerating] = useState(false);
    const [storyboardTaskType, setStoryboardTaskType] = useState<
      "capture" | "sketch" | null
    >(null);
    const [storyboardProgress, setStoryboardProgress] = useState({
      done: 0,
      total: 0,
    });
    const [storyboardSketchingRowIndex, setStoryboardSketchingRowIndex] =
      useState<number | null>(null);
    const storyboardAbortControllerRef = useRef<AbortController | null>(null);

    const handleVisibilityClass = selected
      ? "visible opacity-100"
      : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";

    const { title, rows } = data;
    const nodeLabel = data.nickname ?? title ?? "表格节点";
    const rawColumns = data.columns || TABLE_COLUMNS;
    const dataColumns = rawColumns.filter(
      (column) => column !== STORYBOARD_ACTION_COLUMN,
    );
    const sourceVideoUrl =
      typeof data.sourceVideoUrl === "string" ? data.sourceVideoUrl : "";
    const sourceVideoNodeId =
      typeof data.sourceVideoNodeId === "string" ? data.sourceVideoNodeId : "";
    const characterProfiles = useMemo(
      () =>
        Array.isArray(data.characterProfiles) ? data.characterProfiles : [],
      [data.characterProfiles],
    );
    const storyboardImageCache = useMemo<StoryboardImageCacheMap>(
      () =>
        data.storyboardImageCache &&
          typeof data.storyboardImageCache === "object"
          ? data.storyboardImageCache
          : {},
      [data.storyboardImageCache],
    );
    const isVideoPullFilmTable =
      title === "视频拉片分析" ||
      ["场景", "时长", "镜号", STORYBOARD_IMAGE_COLUMN].every((column) =>
        dataColumns.includes(column),
      );
    const columns = isVideoPullFilmTable
      ? orderVideoPullFilmColumns(ensureStoryboardColumns(dataColumns))
      : dataColumns;
    const displayColumns = getDisplayColumns(columns, isVideoPullFilmTable);
    const storyboardRows = useMemo(
      () =>
        (rows || [])
          .map((row: Record<string, unknown>, rowIndex: number) => {
            const captureTimeMs = parseStoryboardCaptureTimeMs(row.时长);
            return captureTimeMs == null
              ? null
              : {
                row,
                rowIndex,
                captureTimeMs,
              };
          })
          .filter((item): item is StoryboardCaptureRow => item != null),
      [rows],
    );
    const storyboardSketchRows = useMemo(
      () =>
        (rows || [])
          .map((row: Record<string, unknown>, rowIndex: number) => {
            const referenceImageUrl = String(
              row[STORYBOARD_IMAGE_COLUMN] ?? "",
            ).trim();
            return isImageSource(referenceImageUrl)
              ? {
                rowIndex,
                referenceImageUrl,
              }
              : null;
          })
          .filter((item): item is StoryboardSketchRow => item != null),
      [rows],
    );
    const storyboardConcurrencyLimit = Math.max(
      1,
      Math.min(STORYBOARD_CAPTURE_CONCURRENCY, storyboardRows.length || 1),
    );
    const storyboardSketchConcurrencyLimit = Math.max(
      1,
      Math.min(STORYBOARD_SKETCH_CONCURRENCY, storyboardSketchRows.length || 1),
    );
    const selectedStoryboardSketchModel = getSketchModelOption(
      storyboardSketchModel,
      storyboardSketchPlatform,
    );
    const storyboardSketchSizeOptions =
      storyboardSketchModel === AGNES_IMAGE_21_FLASH_MODEL
        ? AGNES_IMAGE_21_SIZE_OPTIONS
        : storyboardSketchModel === AGNES_IMAGE_2_FLASH_MODEL
          ? COMMON_IMAGE_SIZE_OPTIONS
          : WIDE_IMAGE_SIZE_OPTIONS;
    const storyboardSketchResolutionOptions =
      storyboardSketchModel === AGNES_IMAGE_21_FLASH_MODEL
        ? AGNES_IMAGE_21_RESOLUTION_OPTIONS
        : storyboardSketchModel === AGNES_IMAGE_2_FLASH_MODEL
          ? AGNES_IMAGE_RESOLUTION_OPTIONS
          : IMAGE_RESOLUTION_OPTIONS;
    const showStoryboardSketchResolution =
      storyboardSketchModel !== "midjourney" &&
      storyboardSketchModel !== "midjourney-niji7";
    const perStoryboardSketchPoints = normalizeRequiredPoints(
      getImageGenerationPoints({
        model: selectedStoryboardSketchModel.model,
        platform: selectedStoryboardSketchModel.platform,
        count: 1,
        fallback: fallbackAIGenPrice,
      }),
    );
    const storyboardSketchRequiredPoints =
      perStoryboardSketchPoints * storyboardSketchRows.length;
    const isStoryboardCapturing = storyboardTaskType === "capture";
    const isStoryboardSketching = storyboardTaskType === "sketch";

    const handleRenameStart = useCallback(() => {
      if (selected) {
        setIsRenaming(true);
      }
    }, [selected]);

    const handleRename = useCallback(
      (name: string) => {
        updateNodeNickname(id, name);
      },
      [id, updateNodeNickname],
    );

    const handleEditEnd = useCallback(() => setIsRenaming(false), []);

    const nodeIcon = useMemo(() => <IconTable size={14} />, []);

    const requestDeleteNode = useCallback(() => {
      if (isVideoPullFilmTable) {
        requestCanvasDeleteConfirm({
          message:
            "确定要删除视频拉片分析表吗？删除后表格内容、分镜图和分镜草图都会从画布移除。",
          onConfirm: () => deleteNode(id),
        });
        return;
      }

      deleteNode(id);
    }, [deleteNode, id, isVideoPullFilmTable]);

    const toggleFullscreen = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFullscreen(!isFullscreen);
      },
      [isFullscreen],
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        requestDeleteNode();
      },
      [requestDeleteNode],
    );

    const handleUpdateCell = useCallback(
      (rowIndex: number, column: string, value: string) => {
        // 使用函数式更新避免依赖外部 rows，减少重渲染
        updateTableNodeData(id, ((prevData: any) => {
          const currentRows = prevData.rows || [];
          const newRows = [...currentRows];
          newRows[rowIndex] = {
            ...newRows[rowIndex],
            [column]: value,
          };
          return { ...prevData, rows: newRows };
        }) as (prev: Record<string, unknown>) => Record<string, unknown>);
      },
      [id, updateTableNodeData],
    );

    const updateStoryboardImageCell = useCallback(
      (rowIndex: number, value: string) => {
        updateTableNodeData(id, ((prevData: any) => {
          const currentColumns = prevData.columns || [];
          const nextColumns = ensureStoryboardColumns(currentColumns);
          const currentRows = prevData.rows || [];
          const nextRows = [...currentRows];
          nextRows[rowIndex] = {
            ...nextRows[rowIndex],
            [STORYBOARD_IMAGE_COLUMN]: value,
          };

          return {
            ...prevData,
            columns: nextColumns,
            rows: nextRows,
          };
        }) as (prev: Record<string, unknown>) => Record<string, unknown>);
      },
      [id, updateTableNodeData],
    );

    const updateStoryboardSketchCell = useCallback(
      (rowIndex: number, value: string) => {
        updateTableNodeData(id, ((prevData: any) => {
          const currentColumns = prevData.columns || [];
          const nextColumns = ensureStoryboardColumns(currentColumns);
          const currentRows = prevData.rows || [];
          const nextRows = [...currentRows];
          nextRows[rowIndex] = {
            ...nextRows[rowIndex],
            [STORYBOARD_SKETCH_COLUMN]: value,
          };

          return {
            ...prevData,
            columns: nextColumns,
            rows: nextRows,
          };
        }) as (prev: Record<string, unknown>) => Record<string, unknown>);
      },
      [id, updateTableNodeData],
    );

    const generateStoryboardSketchWithRetry = useCallback(
      async ({
        rowIndex,
        referenceImageUrl,
        signal,
      }: GenerateStoryboardSketchWithRetryOptions) => {
        for (
          let retryCount = 0;
          retryCount <= STORYBOARD_SKETCH_RETRY_LIMIT;
          retryCount += 1
        ) {
          if (signal.aborted) {
            throw new Error("已停止生成");
          }

          updateStoryboardSketchCell(
            rowIndex,
            retryCount === 0
              ? "生成中..."
              : `重试中... ${retryCount}/${STORYBOARD_SKETCH_RETRY_LIMIT}`,
          );

          try {
            return await generateTableStoryboardImage({
              model: selectedStoryboardSketchModel.model,
              platform: selectedStoryboardSketchModel.platform,
              prompt: buildStoryboardSketchPrompt(
                storyboardSketchPromptTemplate,
              ),
              size: storyboardSketchSize,
              resolution: showStoryboardSketchResolution
                ? storyboardSketchResolution
                : undefined,
              referenceImageUrls: [referenceImageUrl],
              requiredPoints: perStoryboardSketchPoints,
              signal,
            });
          } catch (generateError) {
            if (signal.aborted || isAbortGenerationError(generateError)) {
              throw generateError;
            }

            if (retryCount >= STORYBOARD_SKETCH_RETRY_LIMIT) {
              throw new Error(
                `${getGenerationErrorMessage(generateError)}（已重试 ${STORYBOARD_SKETCH_RETRY_LIMIT} 次）`,
              );
            }
          }
        }

        throw new Error("生成失败");
      },
      [
        perStoryboardSketchPoints,
        selectedStoryboardSketchModel.model,
        selectedStoryboardSketchModel.platform,
        showStoryboardSketchResolution,
        storyboardSketchPromptTemplate,
        storyboardSketchResolution,
        storyboardSketchSize,
        updateStoryboardSketchCell,
      ],
    );

    const openCharacterProfilesDialog = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setCharacterProfilesDialogOpen(true);
    }, []);

    const closeCharacterProfilesDialog = useCallback(() => {
      setCharacterProfilesDialogOpen(false);
    }, []);

    const openImagePreview = useCallback(
      (imageUrl: string) => {
        setPreviewImageUrl(imageUrl);
      },
      [],
    );

    const handlePreviewImageDownload: NonNullable<
      NonNullable<LightboxProps["download"]>["download"]
    > = useCallback(
      ({ slide }) => {
        const imageUrl = String(
          "src" in slide ? slide.src : previewImageUrl || "",
        ).trim();
        if (!imageUrl) {
          warning("没有可下载的图片");
          return;
        }

        void downloadImageFromUrl(
          imageUrl,
          getStoryboardDownloadFilename(imageUrl),
        ).catch((downloadError) => {
          const message =
            downloadError instanceof Error
              ? downloadError.message
              : "下载失败";
          if (message === "取消下载") return;
          error("图片下载失败", message);
        });
      },
      [error, previewImageUrl, warning],
    );

    const openStoryboardSketchDialog = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isStoryboardCapturing) return;
        if (!storyboardSketchRows.length) {
          warning("没有可参考的分镜图，请先截取分镜图");
          return;
        }
        setStoryboardSketchDialogOpen(true);
      },
      [isStoryboardCapturing, storyboardSketchRows.length, warning],
    );

    const closeStoryboardSketchDialog = useCallback(() => {
      setStoryboardSketchDialogOpen(false);
    }, []);

    const handleStoryboardSketchModelChange = useCallback(
      (value: string) => {
        const selectedModel = IMAGE_MODELS.find(
          (item) => item.id === Number(value),
        );
        if (!selectedModel) return;

        setStoryboardSketchModel(selectedModel.model);
        setStoryboardSketchPlatform(selectedModel.platform);
        if (isAgnesImageModel(selectedModel.model)) {
          const isAgnesImage21 =
            selectedModel.model === AGNES_IMAGE_21_FLASH_MODEL;
          setStoryboardSketchResolution(isAgnesImage21 ? "2K" : "1K");
          const supportedSizeOptions = isAgnesImage21
            ? AGNES_IMAGE_21_SIZE_OPTIONS
            : COMMON_IMAGE_SIZE_OPTIONS;
          if (
            !supportedSizeOptions.some(
              (item) => item.value === storyboardSketchSize,
            )
          ) {
            setStoryboardSketchSize("1:1");
          }
        }
      },
      [storyboardSketchSize],
    );

    const resolveSourceVideo = useCallback((): SourceVideoInfo | null => {
      if (sourceVideoUrl) {
        return {
          videoUrl: sourceVideoUrl,
          videoNodeId: sourceVideoNodeId || undefined,
        };
      }

      const { nodes: currentNodes, edges: currentEdges } =
        useCanvasFlowStore.getState();
      const incomingEdges = currentEdges.filter((edge) => edge.target === id);

      for (const edge of incomingEdges) {
        const directSourceNode = currentNodes.find(
          (node) => node.id === edge.source,
        );
        if (directSourceNode?.type === "newVideoNode") {
          const videoUrl = getVideoUrlFromNode(directSourceNode);
          if (videoUrl) return { videoUrl, videoNodeId: directSourceNode.id };
        }

        const upstreamVideoNode = currentEdges
          .filter((candidateEdge) => candidateEdge.target === edge.source)
          .map((candidateEdge) =>
            currentNodes.find((node) => node.id === candidateEdge.source),
          )
          .find((node) => node?.type === "newVideoNode");
        const videoUrl = getVideoUrlFromNode(upstreamVideoNode);
        if (videoUrl) {
          return { videoUrl, videoNodeId: upstreamVideoNode?.id };
        }
      }

      return null;
    }, [id, sourceVideoNodeId, sourceVideoUrl]);

    const handleExportExcel = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isVideoPullFilmTable) return;
        if (isStoryboardSketching) {
          warning("分镜草图生成中，暂不可导出");
          return;
        }
        if (!rows?.length) {
          warning("没有可导出的表格数据");
          return;
        }

        try {
          const result = await exportVideoPullFilmExcel({
            title: title || "视频拉片分析",
            columns,
            rows,
            characterProfiles,
            storyboardImageCache,
            projectId,
          });
          if (result.saved) {
            if (result.failedImageCount > 0) {
              warning(
                `已导出 ${result.filename}，${result.failedImageCount} 张图片未能嵌入，已保留链接`,
              );
            } else {
              success(`已导出 ${result.filename}`);
            }
          }
        } catch (exportError) {
          const message =
            exportError instanceof Error ? exportError.message : "未知错误";
          error("导出 Excel 失败", message);
        }
      },
      [
        characterProfiles,
        columns,
        error,
        isVideoPullFilmTable,
        isStoryboardSketching,
        projectId,
        rows,
        storyboardImageCache,
        success,
        title,
        warning,
      ],
    );

    const cacheStoryboardImageUrl = useCallback(
      (imageUrl: string, rowIndex: number, signal?: AbortSignal) => {
        void cacheStoryboardImageToProject({
          projectId,
          url: imageUrl,
          rowIndex,
          signal,
        })
          .then((cacheEntry) => {
            if (!cacheEntry.localPath) return;
            updateTableNodeData(id, ((prevData: any) => {
              const prevCache =
                prevData.storyboardImageCache &&
                  typeof prevData.storyboardImageCache === "object"
                  ? prevData.storyboardImageCache
                  : {};
              return {
                ...prevData,
                storyboardImageCache: {
                  ...prevCache,
                  [getStoryboardImageCacheKey(imageUrl)]: cacheEntry,
                },
              };
            }) as (prev: Record<string, unknown>) => Record<string, unknown>);
          })
          .catch((cacheError) => {
            console.warn("[TableNode] 缓存分镜图失败:", cacheError);
          });
      },
      [id, projectId, updateTableNodeData],
    );

    const handleStopStoryboardGeneration = useCallback(
      (e?: React.MouseEvent) => {
        e?.stopPropagation();
        storyboardAbortControllerRef.current?.abort();
      },
      [],
    );

    const handleCaptureStoryboardImages = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (storyboardGenerating) return;
        if (!storyboardRows.length) {
          warning("没有可截取分镜图的有效时间码");
          return;
        }

        const sourceVideo = resolveSourceVideo();
        if (!sourceVideo?.videoUrl) {
          warning("未找到原视频，无法截取分镜图");
          return;
        }

        const abortController = new AbortController();
        storyboardAbortControllerRef.current = abortController;
        setStoryboardGenerating(true);
        setStoryboardTaskType("capture");
        setStoryboardProgress({ done: 0, total: storyboardRows.length });

        let successCount = 0;
        let failedCount = 0;
        let stoppedCount = 0;
        let nextRowIndex = 0;

        const captureNext = async () => {
          while (
            nextRowIndex < storyboardRows.length &&
            !abortController.signal.aborted
          ) {
            const currentIndex = nextRowIndex;
            nextRowIndex += 1;

            const item = storyboardRows[currentIndex];
            if (!item) return;

            updateStoryboardImageCell(item.rowIndex, "截取中...");
            try {
              const snapshotUrl = generateVideoSnapshotUrl(
                sourceVideo.videoUrl,
                {
                  time: item.captureTimeMs,
                  format: "jpg",
                },
              );
              const response = await fetch(snapshotUrl, {
                signal: abortController.signal,
              });
              if (!response.ok) {
                throw new Error(`获取截帧失败：HTTP ${response.status}`);
              }

              const blob = await response.blob();
              const file = new File(
                [blob],
                `storyboard-${item.rowIndex + 1}-${item.captureTimeMs}ms-${Date.now()}.jpg`,
                { type: blob.type || "image/jpeg" },
              );
              const uploadResult = await uploadFileToOSS(file);
              if (!uploadResult.url) {
                throw new Error("上传截帧图片失败");
              }

              if (abortController.signal.aborted) {
                stoppedCount += 1;
                updateStoryboardImageCell(item.rowIndex, "已停止");
              } else {
                updateStoryboardImageCell(item.rowIndex, uploadResult.url);
                cacheStoryboardImageUrl(
                  uploadResult.url,
                  item.rowIndex,
                  abortController.signal,
                );
                successCount += 1;
              }
            } catch (captureError) {
              if (abortController.signal.aborted) {
                stoppedCount += 1;
                updateStoryboardImageCell(item.rowIndex, "已停止");
              } else {
                failedCount += 1;
                const message =
                  captureError instanceof Error
                    ? captureError.message
                    : "截取失败";
                updateStoryboardImageCell(item.rowIndex, `失败：${message}`);
              }
            } finally {
              setStoryboardProgress((current) => ({
                ...current,
                done: Math.min(current.done + 1, current.total),
              }));
            }
          }
        };

        await Promise.all(
          Array.from({ length: storyboardConcurrencyLimit }, () =>
            captureNext(),
          ),
        );

        storyboardAbortControllerRef.current = null;
        setStoryboardGenerating(false);
        setStoryboardTaskType(null);
        if (abortController.signal.aborted) {
          warning(
            successCount > 0
              ? `已停止截取，已完成 ${successCount} 张，已停止 ${stoppedCount} 张`
              : "已停止截取",
          );
          return;
        }

        if (failedCount === 0) {
          success(`已截取 ${successCount} 张分镜图`);
        } else if (successCount > 0) {
          warning(`已截取 ${successCount} 张分镜图，${failedCount} 张失败`);
        } else {
          error("截取分镜图失败", "所有分镜图都截取失败");
        }
      },
      [
        cacheStoryboardImageUrl,
        error,
        resolveSourceVideo,
        storyboardConcurrencyLimit,
        storyboardGenerating,
        storyboardRows,
        success,
        updateStoryboardImageCell,
        warning,
      ],
    );

    const handleGenerateSingleStoryboardSketch = useCallback(
      async (rowIndex: number) => {
        if (
          isStoryboardCapturing ||
          storyboardGenerating ||
          storyboardAbortControllerRef.current
        ) {
          return;
        }

        const row = rows?.[rowIndex] as Record<string, unknown> | undefined;
        if (!row) {
          warning("未找到当前分镜行");
          return;
        }

        const referenceImageUrl = String(
          row[STORYBOARD_IMAGE_COLUMN] ?? "",
        ).trim();
        if (!isImageSource(referenceImageUrl)) {
          warning("请先生成该行的分镜图，再生成分镜草图");
          return;
        }

        const balancePassed = await validateBalanceBeforeGenerate({
          requiredPoints: perStoryboardSketchPoints,
          warning,
          insufficientMessage: (requiredPoints, currentTotalPoints) =>
            `积分不足，当前剩余 ${currentTotalPoints} 积分，生成 1 张分镜草图需要 ${requiredPoints} 积分`,
        });
        if (!balancePassed) return;

        const abortController = new AbortController();
        storyboardAbortControllerRef.current = abortController;
        setStoryboardGenerating(true);
        setStoryboardTaskType("sketch");
        setStoryboardSketchingRowIndex(rowIndex);
        setStoryboardProgress({ done: 0, total: 1 });

        try {
          const sketchUrl = await generateStoryboardSketchWithRetry({
            rowIndex,
            referenceImageUrl,
            signal: abortController.signal,
          });

          if (abortController.signal.aborted) {
            updateStoryboardSketchCell(rowIndex, "已停止");
            warning("已停止生成草图");
            return;
          }

          updateStoryboardSketchCell(rowIndex, sketchUrl);
          cacheStoryboardImageUrl(sketchUrl, rowIndex, abortController.signal);
          success(
            isImageSource(String(row[STORYBOARD_SKETCH_COLUMN] ?? "").trim())
              ? "已重新生成分镜草图"
              : "已生成分镜草图",
          );
        } catch (generateError) {
          if (
            abortController.signal.aborted ||
            isAbortGenerationError(generateError)
          ) {
            updateStoryboardSketchCell(rowIndex, "已停止");
            warning("已停止生成草图");
          } else {
            const message = getGenerationErrorMessage(generateError);
            updateStoryboardSketchCell(rowIndex, `失败：${message}`);
            error("生成分镜草图失败", message);
          }
        } finally {
          setStoryboardProgress({ done: 1, total: 1 });
          await refreshBalanceInfo();
          storyboardAbortControllerRef.current = null;
          setStoryboardGenerating(false);
          setStoryboardTaskType(null);
          setStoryboardSketchingRowIndex(null);
        }
      },
      [
        cacheStoryboardImageUrl,
        error,
        generateStoryboardSketchWithRetry,
        isStoryboardCapturing,
        perStoryboardSketchPoints,
        refreshBalanceInfo,
        rows,
        storyboardGenerating,
        success,
        updateStoryboardSketchCell,
        validateBalanceBeforeGenerate,
        warning,
      ],
    );

    const handleGenerateStoryboardSketches = useCallback(
      async (e?: React.MouseEvent) => {
        e?.stopPropagation();

        if (
          isStoryboardCapturing ||
          storyboardGenerating ||
          storyboardAbortControllerRef.current
        ) {
          return;
        }
        if (!storyboardSketchRows.length) {
          warning("没有可参考的分镜图，请先截取分镜图");
          return;
        }

        const balancePassed = await validateBalanceBeforeGenerate({
          requiredPoints: storyboardSketchRequiredPoints,
          warning,
          insufficientMessage: (requiredPoints, currentTotalPoints) =>
            `积分不足，当前剩余 ${currentTotalPoints} 积分，生成 ${storyboardSketchRows.length} 张分镜草图需要 ${requiredPoints} 积分`,
        });
        if (!balancePassed) return;

        const abortController = new AbortController();
        storyboardAbortControllerRef.current = abortController;
        setStoryboardGenerating(true);
        setStoryboardTaskType("sketch");
        setStoryboardSketchingRowIndex(null);
        setStoryboardProgress({ done: 0, total: storyboardSketchRows.length });

        let successCount = 0;
        let failedCount = 0;
        let stoppedCount = 0;
        let nextRowIndex = 0;

        const generateNext = async () => {
          while (
            nextRowIndex < storyboardSketchRows.length &&
            !abortController.signal.aborted
          ) {
            const currentIndex = nextRowIndex;
            nextRowIndex += 1;

            const item = storyboardSketchRows[currentIndex];
            if (!item) return;

            try {
              const sketchUrl = await generateStoryboardSketchWithRetry({
                rowIndex: item.rowIndex,
                referenceImageUrl: item.referenceImageUrl,
                signal: abortController.signal,
              });

              if (abortController.signal.aborted) {
                stoppedCount += 1;
                updateStoryboardSketchCell(item.rowIndex, "已停止");
              } else {
                updateStoryboardSketchCell(item.rowIndex, sketchUrl);
                cacheStoryboardImageUrl(
                  sketchUrl,
                  item.rowIndex,
                  abortController.signal,
                );
                successCount += 1;
              }
            } catch (generateError) {
              if (
                abortController.signal.aborted ||
                isAbortGenerationError(generateError)
              ) {
                stoppedCount += 1;
                updateStoryboardSketchCell(item.rowIndex, "已停止");
              } else {
                failedCount += 1;
                const message = getGenerationErrorMessage(generateError);
                updateStoryboardSketchCell(item.rowIndex, `失败：${message}`);
              }
            } finally {
              setStoryboardProgress((current) => ({
                ...current,
                done: Math.min(current.done + 1, current.total),
              }));
            }
          }
        };

        await Promise.all(
          Array.from({ length: storyboardSketchConcurrencyLimit }, () =>
            generateNext(),
          ),
        );

        await refreshBalanceInfo();
        storyboardAbortControllerRef.current = null;
        setStoryboardGenerating(false);
        setStoryboardTaskType(null);
        setStoryboardSketchingRowIndex(null);
        if (abortController.signal.aborted) {
          warning(
            successCount > 0
              ? `已停止生成草图，已完成 ${successCount} 张，已停止 ${stoppedCount} 张`
              : "已停止生成草图",
          );
          return;
        }

        if (failedCount === 0) {
          success(`已生成 ${successCount} 张分镜草图`);
          setStoryboardSketchDialogOpen(false);
        } else if (successCount > 0) {
          warning(`已生成 ${successCount} 张分镜草图，${failedCount} 张失败`);
        } else {
          error("生成分镜草图失败", "所有分镜草图都生成失败");
        }
      },
      [
        cacheStoryboardImageUrl,
        error,
        generateStoryboardSketchWithRetry,
        isStoryboardCapturing,
        refreshBalanceInfo,
        storyboardGenerating,
        storyboardSketchConcurrencyLimit,
        storyboardSketchRequiredPoints,
        storyboardSketchRows,
        success,
        updateStoryboardSketchCell,
        validateBalanceBeforeGenerate,
        warning,
      ],
    );

    const storyboardSketchDialogContent = storyboardSketchDialogOpen ? (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeStoryboardSketchDialog();
          }
        }}
      >
        <div className="flex max-h-[86vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141418] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">
                生成分镜草图
              </div>
              <div className="mt-1 text-xs text-white/45">
                {storyboardSketchRows.length} 个参考分镜
              </div>
            </div>
            <button
              type="button"
              onClick={closeStoryboardSketchDialog}
              className="rounded-lg px-2 py-1 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              关闭
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-2">
              <span className="text-xs text-white/45">模型</span>
              <Select
                value={String(selectedStoryboardSketchModel.id)}
                onValueChange={handleStoryboardSketchModelChange}
                disabled={isStoryboardSketching}
              >
                <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={STORYBOARD_SELECT_CONTENT_CLASS}>
                  {IMAGE_MODELS.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={String(item.id)}
                      className={STORYBOARD_SELECT_ITEM_CLASS}
                    >
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-xs text-white/45">图片比例</span>
                <Select
                  value={storyboardSketchSize}
                  onValueChange={setStoryboardSketchSize}
                  disabled={isStoryboardSketching}
                >
                  <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={STORYBOARD_SELECT_CONTENT_CLASS}>
                    {storyboardSketchSizeOptions.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className={STORYBOARD_SELECT_ITEM_CLASS}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showStoryboardSketchResolution ? (
                <div className="grid gap-2">
                  <span className="text-xs text-white/45">分辨率</span>
                  <Select
                    value={storyboardSketchResolution}
                    onValueChange={setStoryboardSketchResolution}
                    disabled={isStoryboardSketching}
                  >
                    <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={STORYBOARD_SELECT_CONTENT_CLASS}>
                      {storyboardSketchResolutionOptions.map((item) => (
                        <SelectItem
                          key={item.value}
                          value={item.value}
                          className={STORYBOARD_SELECT_ITEM_CLASS}
                        >
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <span className="text-xs text-white/45">分辨率</span>
                  <div className="flex h-9 items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-xs text-white/35">
                    模型自动
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <span className="text-xs text-white/45">提示词模板</span>
              <textarea
                value={storyboardSketchPromptTemplate}
                onChange={(event) =>
                  setStoryboardSketchPromptTemplate(event.target.value)
                }
                disabled={isStoryboardSketching}
                rows={7}
                className="min-h-[150px] resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs leading-5 text-white/75 outline-none transition-colors placeholder:text-white/30 focus:border-[#B43FEB]/70 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-xs text-white/55">
                {storyboardSketchRows.length} 张 x {perStoryboardSketchPoints}{" "}
                积分
              </div>
              <ModelPointsBadge
                totalPoints={totalPoints}
                requiredPoints={storyboardSketchRequiredPoints}
                title={`生成草图需要 ${storyboardSketchRequiredPoints} 积分`}
              />
            </div>

            {isStoryboardSketching && (
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-[#B43FEB] transition-all"
                  style={{
                    width: `${storyboardProgress.total
                        ? (storyboardProgress.done / storyboardProgress.total) *
                        100
                        : 0
                      }%`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
            <button
              type="button"
              onClick={closeStoryboardSketchDialog}
              disabled={isStoryboardSketching}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              取消
            </button>
            <button
              type="button"
              onClick={
                isStoryboardSketching
                  ? handleStopStoryboardGeneration
                  : handleGenerateStoryboardSketches
              }
              disabled={storyboardSketchRows.length === 0}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                isStoryboardSketching
                  ? "bg-red-500 hover:bg-red-400"
                  : "bg-[#B43FEB] hover:bg-[#c45bff]",
              )}
            >
              {isStoryboardSketching
                ? `停止生成 ${storyboardProgress.done}/${storyboardProgress.total}`
                : "确认生成"}
            </button>
          </div>
        </div>
      </div>
    ) : null;

    const characterProfilesDialogContent = characterProfilesDialogOpen ? (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeCharacterProfilesDialog();
          }
        }}
      >
        <div className="flex max-h-[86vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141418] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">角色档案</div>
              <div className="mt-1 text-xs text-white/45">
                {characterProfiles.length} 个角色
              </div>
            </div>
            <button
              type="button"
              onClick={closeCharacterProfilesDialog}
              className="rounded-lg px-2 py-1 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              关闭
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {characterProfiles.length > 0 ? (
              <div className="space-y-3">
                {characterProfiles.map((profile, index) => {
                  const details = getCharacterProfileDetails(profile);

                  return (
                    <div
                      key={getCharacterProfileKey(profile, index)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70">
                            <IconUser size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">
                              {getCharacterProfileTitle(profile, index)}
                            </div>
                            <div className="mt-0.5 text-xs text-white/35">
                              角色档案
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/45">
                          #{index + 1}
                        </span>
                      </div>

                      {details.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {details.map((detail) => (
                            <div
                              key={detail.label}
                              className="grid gap-1 rounded-md bg-black/20 px-3 py-2 sm:grid-cols-[88px_1fr] sm:gap-3"
                            >
                              <div className="text-xs text-white/35">
                                {detail.label}
                              </div>
                              <div className="whitespace-pre-wrap break-words text-xs leading-5 text-white/70">
                                {detail.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-md bg-black/20 px-3 py-2 text-xs text-white/35">
                          暂无详细描述
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.03] text-center">
                <IconUser size={24} className="text-white/35" />
                <div className="mt-3 text-sm text-white/60">暂无角色档案</div>
                <div className="mt-1 text-xs text-white/35">
                  视频拉片分析未返回可查看的角色档案
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null;

    const fullscreenContent = (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#141418] to-[#0d0d10] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="text-base font-semibold text-white">
            {title || "角色设计表"}
          </div>
          <div className="flex items-center gap-2">
            {isVideoPullFilmTable && (
              <>
                <button
                  onClick={handleExportExcel}
                  disabled={isStoryboardSketching}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  title="导出 Excel"
                >
                  <IconDownload size={14} />
                  <span>导出</span>
                </button>
                <button
                  onClick={openCharacterProfilesDialog}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  title="角色档案"
                >
                  <IconUser size={14} />
                  <span>角色档案</span>
                </button>
                <button
                  onClick={
                    isStoryboardCapturing
                      ? handleStopStoryboardGeneration
                      : handleCaptureStoryboardImages
                  }
                  disabled={storyboardGenerating && !isStoryboardCapturing}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                    isStoryboardCapturing
                      ? "bg-red-500 hover:bg-red-400"
                      : "bg-[#B43FEB] hover:bg-[#c45bff]",
                  )}
                  title={isStoryboardCapturing ? "停止截取" : "截取分镜图"}
                >
                  <IconPhotoPlus size={14} />
                  <span>
                    {isStoryboardCapturing
                      ? `停止截取 ${storyboardProgress.done}/${storyboardProgress.total}`
                      : "截取分镜图"}
                  </span>
                </button>
                <button
                  onClick={
                    isStoryboardSketching
                      ? handleStopStoryboardGeneration
                      : openStoryboardSketchDialog
                  }
                  disabled={isStoryboardCapturing}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                    isStoryboardSketching
                      ? "bg-red-500 hover:bg-red-400"
                      : "bg-[#B43FEB] hover:bg-[#c45bff]",
                  )}
                  title={
                    isStoryboardCapturing
                      ? "截取中，暂不可生成草图"
                      : isStoryboardSketching
                        ? "停止生成草图"
                        : "生成分镜草图"
                  }
                >
                  <IconPencil size={14} />
                  <span>
                    {isStoryboardSketching
                      ? `停止草图 ${storyboardProgress.done}/${storyboardProgress.total}`
                      : "生成分镜草图"}
                  </span>
                </button>
              </>
            )}
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-white/5 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="退出全屏"
            >
              <MinimizeIcon />
            </button>
            <button
              onClick={handleDelete}
              className="w-8 h-8 rounded-lg bg-white/5 text-white/70 hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors cursor-pointer"
              title="删除"
            >
              <DeleteIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="bg-[#1A1A1C] rounded-lg border border-white/[0.06] overflow-auto min-w-full">
            <table className="border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#1A1A1C]">
                <tr>
                  {displayColumns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 border-b border-r border-white/[0.06] text-[#8D8D8E]/70 font-medium text-sm whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableBody
                  rows={rows || []}
                  columns={displayColumns}
                  onUpdateCell={handleUpdateCell}
                  onPreviewImage={openImagePreview}
                  onGenerateStoryboardSketch={
                    isVideoPullFilmTable
                      ? handleGenerateSingleStoryboardSketch
                      : undefined
                  }
                  storyboardActionDisabled={storyboardGenerating}
                  storyboardSketchingRowIndex={storyboardSketchingRowIndex}
                  maxWidth="200px"
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    return (
      <>
        {isFullscreen && createPortal(fullscreenContent, document.body)}
        {storyboardSketchDialogContent &&
          createPortal(storyboardSketchDialogContent, document.body)}
        {characterProfilesDialogContent &&
          createPortal(characterProfilesDialogContent, document.body)}
        {previewImageUrl ? (
          <Lightbox
            open={Boolean(previewImageUrl)}
            close={() => setPreviewImageUrl(null)}
            slides={[{ src: previewImageUrl }]}
            plugins={[Fullscreen, Slideshow, Zoom, Share, Download]}
            download={{ download: handlePreviewImageDownload }}
            zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 2 }}
            controller={{ closeOnBackdropClick: true }}
          />
        ) : null}

        <NodeContextMenu
          onDuplicate={() => duplicateNode(id)}
          onDelete={requestDeleteNode}
        >
          <div className="group/node relative">
            <NodeResizer
              isVisible={selected && !isDragging}
              lineClassName="!border !border-[#B43FEB]/50"
              handleClassName="!w-5 !h-5 !bg-transparent !border-0"
            />

            <div
              style={{
                width: width || 700,
                height: height || 350,
              }}
              className={cn(
                "group/card relative flex h-full w-full flex-col rounded-xl border transition-all duration-300 ease-out overflow-hidden",
                selected
                  ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30 bg-gradient-to-br from-[#141418] to-[#0d0d10]"
                  : "border-white/[0.06] hover:border-white/[0.12] hover:bg-gradient-to-br hover:from-[#18181c] hover:to-[#101014] bg-gradient-to-br from-[#141418] to-[#0d0d10]",
              )}
            >
              <NodeNameBadge
                icon={nodeIcon}
                selected={selected}
                isEditing={isRenaming}
                onEditStart={handleRenameStart}
                onEditEnd={handleEditEnd}
                onRename={handleRename}
              >
                {nodeLabel}
              </NodeNameBadge>

              <ButtonHandle
                type="target"
                position={Position.Left}
                id="input"
                visible
                className={`${handleVisibilityClass}`}
              />

              <ButtonHandle
                type="source"
                position={Position.Right}
                id="output"
                visible
                className={` ${handleVisibilityClass}`}
              />
              {shouldShowToolbar && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  {isVideoPullFilmTable && (
                    <>
                      <button
                        onClick={handleExportExcel}
                        disabled={isStoryboardSketching}
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-black/50 px-2 text-[11px] text-white/70 hover:bg-white/10 hover:text-white backdrop-blur-md border border-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                        title="导出 Excel"
                      >
                        <IconDownload size={13} />
                        <span>导出</span>
                      </button>
                      <button
                        onClick={openCharacterProfilesDialog}
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-black/50 px-2 text-[11px] text-white/70 hover:bg-white/10 hover:text-white backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                        title="角色档案"
                      >
                        <IconUser size={13} />
                        <span>角色档案</span>
                      </button>
                      <button
                        onClick={
                          isStoryboardCapturing
                            ? handleStopStoryboardGeneration
                            : handleCaptureStoryboardImages
                        }
                        disabled={
                          storyboardGenerating && !isStoryboardCapturing
                        }
                        className={cn(
                          "w-7 h-7 rounded-lg text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45",
                          isStoryboardCapturing
                            ? "bg-red-500 hover:bg-red-400 border border-red-400/70"
                            : "bg-[#B43FEB] hover:bg-[#c45bff] border border-[#B43FEB]/70",
                        )}
                        title={
                          isStoryboardCapturing ? "停止截取" : "截取分镜图"
                        }
                      >
                        <IconPhotoPlus size={14} />
                      </button>
                      <button
                        onClick={
                          isStoryboardSketching
                            ? handleStopStoryboardGeneration
                            : openStoryboardSketchDialog
                        }
                        disabled={isStoryboardCapturing}
                        className={cn(
                          "w-7 h-7 rounded-lg text-white/80 flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45",
                          isStoryboardSketching
                            ? "bg-red-500 text-white hover:bg-red-400 border-red-400/70"
                            : "bg-[#B43FEB] text-white hover:bg-[#c45bff] border-[#B43FEB]/70",
                        )}
                        title={
                          isStoryboardCapturing
                            ? "截取中，暂不可生成草图"
                            : isStoryboardSketching
                              ? "停止生成草图"
                              : "生成分镜草图"
                        }
                      >
                        <IconPencil size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={toggleFullscreen}
                    className="w-7 h-7 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                    title="全屏"
                  >
                    <FullscreenIcon />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-7 h-7 rounded-lg bg-black/50 text-white/70 hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                    title="删除"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              )}

              <div className="flex flex-col h-full overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <h3 className="text-sm font-semibold text-white">
                    {title || "角色设计表"}
                  </h3>
                </div>

                <div className="flex-1 overflow-auto p-2 nodrag nopan nowheel">
                  <div className="bg-[#1A1A1C] rounded-lg border border-white/[0.06] overflow-auto min-w-full">
                    <table className="border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-[#1A1A1C]">
                        <tr>
                          {displayColumns.map((col) => (
                            <th
                              key={col}
                              className="px-3 py-2 border-b border-r border-white/[0.06] text-[#8D8D8E]/70 font-medium text-xs whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <TableBody
                          rows={rows || []}
                          columns={displayColumns}
                          onUpdateCell={handleUpdateCell}
                          onPreviewImage={openImagePreview}
                          onGenerateStoryboardSketch={
                            isVideoPullFilmTable
                              ? handleGenerateSingleStoryboardSketch
                              : undefined
                          }
                          storyboardActionDisabled={storyboardGenerating}
                          storyboardSketchingRowIndex={
                            storyboardSketchingRowIndex
                          }
                          maxWidth="120px"
                        />
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </NodeContextMenu>
      </>
    );
  },
);

TableNode.displayName = "TableNode";
