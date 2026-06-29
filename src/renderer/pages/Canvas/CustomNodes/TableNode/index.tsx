import { IconDownload, IconPhotoPlus, IconTable, IconUser } from "@tabler/icons-react";
import { type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AGNES_IMAGE_2_FLASH_MODEL,
  AGNES_PLATFORM,
  IMAGE_MODELS,
} from "shared/constants/ai-models";
import { getImageGenerationPoints } from "shared/constants/model-points";
import { VIDEO_PULL_FILM_COLUMNS } from "shared/constants/video-agent-presets";
import type { CharacterTableRow, TableNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
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
import { exportVideoPullFilmExcel } from "@/services/tableExcelExport";
import { generateTableStoryboardImage } from "@/services/tableStoryboardImageGeneration";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";

const TABLE_COLUMNS = [
  "姓名",
  "基础设定",
  "性格特征",
  "核心动机",
  "核心关系",
  "习惯和兴趣",
];

const STORYBOARD_IMAGE_COLUMN = "分镜图";
const STORYBOARD_PROMPT_COLUMNS = [
  "场景",
  "镜号",
  "角色",
  "景别",
  "画面",
  "角度",
  "主体动作",
  "信息点",
  "技参",
] as const;

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

const STORYBOARD_SELECT_CONTENT_CLASS =
  "!z-[10001] border border-white/10 bg-[#141418] text-white shadow-2xl ring-white/10";
const STORYBOARD_SELECT_ITEM_CLASS =
  "text-white focus:bg-white/10 focus:text-white data-[state=checked]:text-[#B43FEB] data-[state=checked]:focus:text-[#B43FEB]";

const DEFAULT_STORYBOARD_IMAGE_PROMPT_TEMPLATE = [
  "你是一名影视分镜师和翻拍导演，请根据分镜信息生成一张可用于后续翻拍参考的单镜头分镜图。",
  "角色设定：",
  "{{character_profiles}}",
  "分镜信息：",
  "{{storyboard_info}}",
  "生成约束：",
  "1. 必须输出单张完整图像，一个画面，一张图，无网格、无拼贴、无分屏、无九宫格。",
  "2. 画面中只保留一个核心主体或一个主要人物，不要生成多人同框、群像、多个角色站位；如果分镜信息里出现多个人物，只表现最关键动作执行者，其他人用环境、视线方向、道具或虚化背景暗示。",
  "3. 严格保持角色样貌、发型、服装、颜色、体型、道具和明显特征一致，不要随意换衣服、换发型、换年龄、换性别。",
  "4. 严格根据场景、镜号、景别、画面、角度、主体动作、信息点、技参确定构图和镜头语言，不额外添加与分镜无关的剧情。",
  "5. 画面应像真实电影分镜或导演预演图，主体清晰，机位、景别、动作方向和运动趋势明确，便于后续翻拍执行。",
  "6. 不要出现文字、字幕、水印、UI、表格、说明性标注、画中画、分屏。",
].join("\n");

const STORYBOARD_CONCURRENCY_OPTIONS = [
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
];

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

const getDefaultStoryboardImageModel = () =>
  IMAGE_MODELS.find((model) => model.model === AGNES_IMAGE_2_FLASH_MODEL) ??
  IMAGE_MODELS[0];

const getModelOption = (model: string, platform?: string) =>
  IMAGE_MODELS.find(
    (item) => item.model === model && item.platform === platform,
  ) ??
  IMAGE_MODELS.find((item) => item.model === model) ??
  getDefaultStoryboardImageModel();

const isImageSource = (value?: string) =>
  Boolean(
    value &&
      (/^https?:\/\//i.test(value) ||
        value.startsWith("data:image/") ||
        value.startsWith("blob:")),
  );

const buildStoryboardPromptInfo = (row: Record<string, unknown>) =>
  STORYBOARD_PROMPT_COLUMNS.map((column) => {
    const value = String(row[column] ?? "").trim();
    return value ? `${column}：${value}` : "";
  })
    .filter(Boolean)
    .join("\n");

const normalizeStoryboardName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[【】\[\]（）()《》"'“”‘’\s]/g, "")
    .toLowerCase();

const splitStoryboardNames = (value: unknown) =>
  String(value ?? "")
    .split(/[、,，/／;；\s]+/)
    .map(normalizeStoryboardName)
    .filter(Boolean)
    .filter((name) => !["无", "无人物", "无角色", "环境", "空镜"].includes(name));

const formatCharacterProfile = (profile: unknown) => {
  if (!profile || typeof profile !== "object") return "";
  const item = profile as Record<string, unknown>;
  const name = String(item.name ?? item.角色 ?? "").trim();
  if (!name) return "";

  const aliases = Array.isArray(item.aliases)
    ? item.aliases.filter(Boolean).join("、")
    : String(item.别名 ?? "").trim();
  const parts = [
    aliases ? `别名：${aliases}` : "",
    item.appearance || item.样貌 ? `样貌：${item.appearance ?? item.样貌}` : "",
    item.outfit || item.穿着 ? `穿着：${item.outfit ?? item.穿着}` : "",
    item.accessories || item.道具
      ? `道具：${item.accessories ?? item.道具}`
      : "",
    item.distinctiveFeatures || item.明显特征
      ? `明显特征：${item.distinctiveFeatures ?? item.明显特征}`
      : "",
    item.consistencyPrompt || item.一致性提示
      ? `一致性提示：${item.consistencyPrompt ?? item.一致性提示}`
      : "",
  ].filter(Boolean);

  return `${name}：${parts.join("；") || String(item.raw ?? "").trim()}`;
};

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
    .map(([key, value]) => ({ label: key, value: stringifyProfileValue(value) }))
    .filter(({ value }) => Boolean(value));
};

const getCharacterProfileNames = (profile: unknown) => {
  if (!profile || typeof profile !== "object") return [];
  const item = profile as Record<string, unknown>;
  const names = [
    item.name,
    item.角色,
    ...(Array.isArray(item.aliases) ? item.aliases : []),
    item.别名,
  ];
  return names.flatMap(splitStoryboardNames);
};

const buildCharacterProfilesPrompt = (
  row: Record<string, unknown>,
  profiles?: unknown[],
) => {
  if (!profiles?.length) return "无明确角色档案";

  const rowNames = splitStoryboardNames(row.角色);
  const matchedProfiles =
    rowNames.length > 0
      ? profiles.filter((profile) => {
          const profileNames = getCharacterProfileNames(profile);
          return rowNames.some((rowName) => profileNames.includes(rowName));
        })
      : [];
  const selectedProfiles =
    matchedProfiles.length > 0
      ? matchedProfiles
      : rowNames.length === 0 && profiles.length === 1
        ? profiles
        : [];
  const profileLines = selectedProfiles.map(formatCharacterProfile).filter(Boolean);

  return profileLines.length > 0 ? profileLines.join("\n") : "无明确角色档案";
};

const buildStoryboardImagePrompt = (
  row: Record<string, unknown>,
  template: string,
  characterProfiles?: unknown[],
) => {
  const promptTemplate =
    template.trim() || DEFAULT_STORYBOARD_IMAGE_PROMPT_TEMPLATE;
  const promptInfo = buildStoryboardPromptInfo(row) || "无";
  const characterProfilesPrompt = buildCharacterProfilesPrompt(
    row,
    characterProfiles,
  );
  let result = promptTemplate
    .split("{{storyboard_info}}")
    .join(promptInfo)
    .split("{{character_profiles}}")
    .join(characterProfilesPrompt);

  if (!promptTemplate.includes("{{storyboard_info}}")) {
    result = [result, "分镜信息：", promptInfo].join("\n");
  }
  if (!promptTemplate.includes("{{character_profiles}}")) {
    result = [result, "角色设定：", characterProfilesPrompt].join("\n");
  }
  return result;
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
  maxWidth?: string;
  className?: string;
}

const EditableCell = memo(
  ({
    value,
    rowIndex,
    column,
    onUpdate,
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

    if (column === STORYBOARD_IMAGE_COLUMN && !isEditing) {
      if (isImageSource(value)) {
        return (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="block w-[148px] overflow-hidden rounded-md border border-white/10 bg-black/20"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={handleDoubleClick}
          >
            <img
              src={value}
              alt=""
              className="h-[84px] w-full object-cover"
              draggable={false}
            />
          </a>
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
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
            }
            e.stopPropagation();
          }}
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
  maxWidth?: string;
  cellClassName?: string;
}

const TableBody = memo(
  ({
    rows,
    columns,
    onUpdateCell,
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
            {columns.map((col) => (
              <td
                key={col}
                className={cn(
                  "relative px-3 py-2 border-b border-r border-white/[0.06] text-[#8D8D8E] text-xs align-top",
                  cellClassName,
                )}
              >
                <EditableCell
                  value={row[col as keyof typeof row] || ""}
                  rowIndex={rowIndex}
                  column={col}
                  onUpdate={onUpdateCell}
                  maxWidth={maxWidth}
                />
              </td>
            ))}
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
    const shouldShowToolbar =
      selected && !isDragging && !hasMultipleSelected;
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
    const [characterProfilesDialogOpen, setCharacterProfilesDialogOpen] =
      useState(false);
    const defaultStoryboardModel = useMemo(
      () => getDefaultStoryboardImageModel(),
      [],
    );
    const [storyboardDialogOpen, setStoryboardDialogOpen] = useState(false);
    const [storyboardModel, setStoryboardModel] = useState(
      defaultStoryboardModel.model,
    );
    const [storyboardPlatform, setStoryboardPlatform] = useState(
      defaultStoryboardModel.platform,
    );
    const [storyboardSize, setStoryboardSize] = useState("1:1");
    const [storyboardResolution, setStoryboardResolution] = useState("1K");
    const [storyboardConcurrency, setStoryboardConcurrency] = useState("6");
    const [storyboardPromptTemplate, setStoryboardPromptTemplate] = useState(
      DEFAULT_STORYBOARD_IMAGE_PROMPT_TEMPLATE,
    );
    const [storyboardGenerating, setStoryboardGenerating] = useState(false);
    const [storyboardProgress, setStoryboardProgress] = useState({
      done: 0,
      total: 0,
    });
    const storyboardAbortControllerRef = useRef<AbortController | null>(null);

    const handleVisibilityClass = selected
      ? "visible opacity-100"
      : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";

    const { title, rows } = data;
    const nodeLabel = data.nickname ?? title ?? "表格节点";
    const columns = data.columns || TABLE_COLUMNS;
    const characterProfiles = useMemo(
      () =>
        Array.isArray(data.characterProfiles) ? data.characterProfiles : [],
      [data.characterProfiles],
    );
    const isVideoPullFilmTable =
      title === "视频拉片分析" ||
      VIDEO_PULL_FILM_COLUMNS.every((column) => columns.includes(column));
    const storyboardRows = useMemo(
      () =>
        (rows || [])
          .map((row: Record<string, unknown>, rowIndex: number) => ({
            row,
            rowIndex,
          }))
          .filter(({ row }) =>
            STORYBOARD_PROMPT_COLUMNS.some((column) =>
              String(row[column] ?? "").trim(),
            ),
          ),
      [rows],
    );
    const selectedStoryboardModel = getModelOption(
      storyboardModel,
      storyboardPlatform,
    );
    const storyboardSizeOptions =
      storyboardModel === AGNES_IMAGE_2_FLASH_MODEL
        ? COMMON_IMAGE_SIZE_OPTIONS
        : WIDE_IMAGE_SIZE_OPTIONS;
    const storyboardResolutionOptions =
      storyboardModel === AGNES_IMAGE_2_FLASH_MODEL
        ? AGNES_IMAGE_RESOLUTION_OPTIONS
        : IMAGE_RESOLUTION_OPTIONS;
    const showStoryboardResolution =
      storyboardModel !== "midjourney" && storyboardModel !== "midjourney-niji7";
    const perStoryboardImagePoints = normalizeRequiredPoints(
      getImageGenerationPoints({
        model: selectedStoryboardModel.model,
        platform: selectedStoryboardModel.platform,
        count: 1,
        fallback: fallbackAIGenPrice,
      }),
    );
    const storyboardRequiredPoints =
      perStoryboardImagePoints * storyboardRows.length;
    const storyboardConcurrencyLimit = Math.max(
      1,
      Math.min(Number(storyboardConcurrency) || 1, storyboardRows.length || 1),
    );

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
        deleteNode(id);
      },
      [deleteNode, id],
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
          const nextColumns = currentColumns.includes(STORYBOARD_IMAGE_COLUMN)
            ? currentColumns
            : [...currentColumns, STORYBOARD_IMAGE_COLUMN];
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

    const openStoryboardDialog = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setStoryboardDialogOpen(true);
    }, []);

    const openCharacterProfilesDialog = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setCharacterProfilesDialogOpen(true);
    }, []);

    const closeCharacterProfilesDialog = useCallback(() => {
      setCharacterProfilesDialogOpen(false);
    }, []);

    const closeStoryboardDialog = useCallback(() => {
      setStoryboardDialogOpen(false);
    }, []);

    const handleExportExcel = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isVideoPullFilmTable) return;
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
          });
          if (result.saved) {
            if (result.failedImageCount > 0) {
              warning(
                `已导出 ${result.filename}，${result.failedImageCount} 张分镜图未能嵌入，已保留链接`,
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
        rows,
        success,
        title,
        warning,
      ],
    );

    const handleStoryboardModelChange = useCallback((value: string) => {
      const selectedModel = IMAGE_MODELS.find((item) => item.id === Number(value));
      if (!selectedModel) return;
      setStoryboardModel(selectedModel.model);
      setStoryboardPlatform(selectedModel.platform);
      if (
        selectedModel.model === AGNES_IMAGE_2_FLASH_MODEL ||
        selectedModel.platform === AGNES_PLATFORM
      ) {
        setStoryboardResolution("1K");
        if (!COMMON_IMAGE_SIZE_OPTIONS.some((item) => item.value === storyboardSize)) {
          setStoryboardSize("1:1");
        }
      }
    }, [storyboardSize]);

    const handleStopStoryboardGeneration = useCallback(() => {
      storyboardAbortControllerRef.current?.abort();
    }, []);

    const handleGenerateStoryboardImages = useCallback(async () => {
      if (storyboardGenerating) return;
      if (!storyboardRows.length) {
        warning("没有可生成分镜图的表格行");
        return;
      }

      const balancePassed = await validateBalanceBeforeGenerate({
        requiredPoints: storyboardRequiredPoints,
        warning,
        insufficientMessage: (requiredPoints, currentTotalPoints) =>
          `积分不足，当前剩余 ${currentTotalPoints} 积分，一键生成 ${storyboardRows.length} 张分镜图需要 ${requiredPoints} 积分`,
      });
      if (!balancePassed) return;

      const abortController = new AbortController();
      storyboardAbortControllerRef.current = abortController;
      setStoryboardGenerating(true);
      setStoryboardProgress({ done: 0, total: storyboardRows.length });

      let successCount = 0;
      let failedCount = 0;
      let stoppedCount = 0;
      let nextRowIndex = 0;

      const generateNext = async () => {
        while (
          nextRowIndex < storyboardRows.length &&
          !abortController.signal.aborted
        ) {
          const currentIndex = nextRowIndex;
          nextRowIndex += 1;

          const item = storyboardRows[currentIndex];
          if (!item) return;

          updateStoryboardImageCell(item.rowIndex, "生成中...");
          try {
            const imageUrl = await generateTableStoryboardImage({
              model: selectedStoryboardModel.model,
              platform: selectedStoryboardModel.platform,
              prompt: buildStoryboardImagePrompt(
                item.row,
                storyboardPromptTemplate,
                characterProfiles,
              ),
              size: storyboardSize,
              resolution: showStoryboardResolution
                ? storyboardResolution
                : undefined,
              requiredPoints: perStoryboardImagePoints,
              signal: abortController.signal,
            });
            if (abortController.signal.aborted) {
              stoppedCount += 1;
              updateStoryboardImageCell(item.rowIndex, "已停止");
            } else {
              updateStoryboardImageCell(item.rowIndex, imageUrl);
              successCount += 1;
            }
          } catch (generateError) {
            if (abortController.signal.aborted) {
              stoppedCount += 1;
              updateStoryboardImageCell(item.rowIndex, "已停止");
            } else {
              failedCount += 1;
              const message =
                generateError instanceof Error
                  ? generateError.message
                  : "生成失败";
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
          generateNext(),
        ),
      );

      await refreshBalanceInfo();
      storyboardAbortControllerRef.current = null;
      setStoryboardGenerating(false);
      if (abortController.signal.aborted) {
        warning(
          successCount > 0
            ? `已停止生成，已完成 ${successCount} 张，已停止 ${stoppedCount} 张`
            : "已停止生成",
        );
        return;
      }

      if (failedCount === 0) {
        success(`已生成 ${successCount} 张分镜图`);
        setStoryboardDialogOpen(false);
      } else if (successCount > 0) {
        warning(`已生成 ${successCount} 张分镜图，${failedCount} 张失败`);
      } else {
        error("生成分镜图失败", "所有分镜图都生成失败");
      }
    }, [
      error,
      perStoryboardImagePoints,
      refreshBalanceInfo,
      storyboardConcurrencyLimit,
      selectedStoryboardModel.model,
      selectedStoryboardModel.platform,
      characterProfiles,
      showStoryboardResolution,
      storyboardGenerating,
      storyboardPromptTemplate,
      storyboardRequiredPoints,
      storyboardResolution,
      storyboardRows,
      storyboardSize,
      success,
      updateStoryboardImageCell,
      validateBalanceBeforeGenerate,
      warning,
    ]);

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

    const storyboardDialogContent = storyboardDialogOpen ? (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeStoryboardDialog();
          }
        }}
      >
        <div className="flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141418] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">
                生成分镜图
              </div>
              <div className="mt-1 text-xs text-white/45">
                {storyboardRows.length} 个分镜
              </div>
            </div>
            <button
              type="button"
              onClick={closeStoryboardDialog}
              className="rounded-lg px-2 py-1 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              关闭
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-2">
              <span className="text-xs text-white/45">模型</span>
              <Select
                value={String(selectedStoryboardModel.id)}
                onValueChange={handleStoryboardModelChange}
                disabled={storyboardGenerating}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <span className="text-xs text-white/45">图片比例</span>
                <Select
                  value={storyboardSize}
                  onValueChange={setStoryboardSize}
                  disabled={storyboardGenerating}
                >
                  <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={STORYBOARD_SELECT_CONTENT_CLASS}>
                    {storyboardSizeOptions.map((item) => (
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

              {showStoryboardResolution ? (
                <div className="grid gap-2">
                  <span className="text-xs text-white/45">分辨率</span>
                  <Select
                    value={storyboardResolution}
                    onValueChange={setStoryboardResolution}
                    disabled={storyboardGenerating}
                  >
                    <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={STORYBOARD_SELECT_CONTENT_CLASS}>
                      {storyboardResolutionOptions.map((item) => (
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

              <div className="grid gap-2">
                <span className="text-xs text-white/45">并发数</span>
                <Select
                  value={storyboardConcurrency}
                  onValueChange={setStoryboardConcurrency}
                  disabled={storyboardGenerating}
                >
                  <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={STORYBOARD_SELECT_CONTENT_CLASS}>
                    {STORYBOARD_CONCURRENCY_OPTIONS.map((item) => (
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
            </div>

            <div className="grid gap-2">
              <span className="text-xs text-white/45">提示词模板</span>
              <textarea
                value={storyboardPromptTemplate}
                onChange={(event) =>
                  setStoryboardPromptTemplate(event.target.value)
                }
                disabled={storyboardGenerating}
                rows={8}
                className="min-h-[180px] resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs leading-5 text-white/75 outline-none transition-colors placeholder:text-white/30 focus:border-[#B43FEB]/70 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-xs text-white/55">
                {storyboardRows.length} 张 × {perStoryboardImagePoints} 积分
              </div>
              <ModelPointsBadge
                totalPoints={totalPoints}
                requiredPoints={storyboardRequiredPoints}
                title={`一键生成需要 ${storyboardRequiredPoints} 积分`}
              />
            </div>

            {storyboardGenerating && (
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-[#B43FEB] transition-all"
                  style={{
                    width: `${storyboardProgress.total ? (storyboardProgress.done / storyboardProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
            <button
              type="button"
              onClick={closeStoryboardDialog}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              取消
            </button>
            <button
              type="button"
              onClick={
                storyboardGenerating
                  ? handleStopStoryboardGeneration
                  : handleGenerateStoryboardImages
              }
              disabled={storyboardRows.length === 0}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                storyboardGenerating
                  ? "bg-red-500 hover:bg-red-400"
                  : "bg-[#B43FEB] hover:bg-[#c45bff]",
              )}
            >
              {storyboardGenerating
                ? `停止生成 ${storyboardProgress.done}/${storyboardProgress.total}`
                : "确认生成"}
            </button>
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
                  onClick={openStoryboardDialog}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#B43FEB] px-3 text-xs text-white transition-colors hover:bg-[#c45bff]"
                  title="生成分镜图"
                >
                  <IconPhotoPlus size={14} />
                  <span>生成分镜图</span>
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
                  {columns.map((col) => (
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
                  columns={columns}
                  onUpdateCell={handleUpdateCell}
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
        {characterProfilesDialogContent &&
          createPortal(characterProfilesDialogContent, document.body)}
        {storyboardDialogContent &&
          createPortal(storyboardDialogContent, document.body)}

        <NodeContextMenu
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
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
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-black/50 px-2 text-[11px] text-white/70 hover:bg-white/10 hover:text-white backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
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
                        onClick={openStoryboardDialog}
                        className="w-7 h-7 rounded-lg bg-[#B43FEB] text-white hover:bg-[#c45bff] flex items-center justify-center backdrop-blur-md border border-[#B43FEB]/70 transition-colors cursor-pointer"
                        title="生成分镜图"
                      >
                        <IconPhotoPlus size={14} />
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
                          {columns.map((col) => (
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
                          columns={columns}
                          onUpdateCell={handleUpdateCell}
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
