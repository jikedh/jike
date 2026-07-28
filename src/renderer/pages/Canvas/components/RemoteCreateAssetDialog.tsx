/**
 * Canvas 远程资产创建弹窗
 *
 * 使用场景：
 *   1. 用户从节点右键“创建为项目资产”
 *   2. 资产库 UI 中点击“上传资产”
 *
 * 流程：
 * - 入参为 RemoteCreateAssetRequest：媒体类型 + Blob 或远程 URL + 来源元信息
 * - 用户在表单中选择：scope、主分类、名称、描述、标签
 * - 提交时调用 uploadAndCreateAsset 进入完整上传链路
 */

import {
  IconChevronDown,
  IconChevronUp,
  IconMusic,
  IconPhoto,
  IconTag,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getAssetCategories, getAssetPersonCategories } from "@/api/assets";
import type {
  AssetCategory,
  AssetScope,
  MediaType,
  PersonCategory,
  PrimaryCategory,
} from "shared/types/api/assets";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { ASSET_TAG_TAXONOMY } from "@/pages/Assets/tagTaxonomy";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchBlobFromUrl,
  uploadAndCreateAsset,
} from "../utils/remoteAssetUpload";
import {
  formatFileSize,
  getDefaultPrimaryCategory,
  guessExtensionFromUrl,
} from "../utils/remoteAssets";
import { AssetCategoryCascadeSelect } from "./AssetCategoryCascadeSelect";

export interface RemoteCreateAssetRequest {
  mediaType: MediaType;
  /** 初始名称（节点 nickname 或文件名） */
  initialName: string;
  /** 来源 1：本地 Blob/File（用户从上传按钮选择） */
  blob?: Blob;
  /** 来源 2：远程 URL（节点已生成媒体） */
  url?: string;
  /** 文件名（用于 OSS key） */
  fileName?: string;
  /** 节点 ID，用于资产 source 元信息 */
  nodeId?: string;
  /** 当前项目 ID */
  projectId?: string | null;
  /** 默认 scope：可由调用方指定 */
  defaultScope?: AssetScope;
}

export interface RemoteCreateAssetDialogProps {
  open: boolean;
  request: RemoteCreateAssetRequest | null;
  onClose: () => void;
  onCreated?: () => void;
}

const SCOPE_OPTIONS: Array<{ id: AssetScope; label: string; hint: string }> = [
  { id: "project", label: "项目资产", hint: "归属当前项目，项目成员可见" },
  { id: "personal", label: "个人资产", hint: "仅自己可见，可后续升级" },
];

const FALLBACK_CATEGORY_OPTIONS: AssetCategory[] = [
  { id: "character", code: "character", name: "角色", sort: 10, status: 1 },
  { id: "scene", code: "scene", name: "场景", sort: 20, status: 1 },
  { id: "prop", code: "prop", name: "道具", sort: 30, status: 1 },
];

/** 后端允许分类 code 为空，此处优先以 code 作为分类值，缺省回退到分类 ID。 */
const getCategoryValue = (category: AssetCategory): PrimaryCategory =>
  category.code.trim() || String(category.id);

/** 在分类树中按分类值查找节点；找不到时回退到首个叶子分类。 */
const getAssetCategoryValueFromTree = (
  categories: AssetCategory[],
  preferredValue: PrimaryCategory,
): PrimaryCategory => {
  const stack: AssetCategory[] = [...categories];
  let firstLeaf: AssetCategory | null = null;
  while (stack.length > 0) {
    const node = stack.pop() as AssetCategory;
    if (getCategoryValue(node) === preferredValue) {
      return getCategoryValue(node);
    }
    if (node.children && node.children.length > 0) {
      stack.push(...node.children);
    } else if (!firstLeaf) {
      firstLeaf = node;
    }
  }
  if (firstLeaf) {
    return getCategoryValue(firstLeaf);
  }
  return preferredValue;
};

const getDefaultName = (request: RemoteCreateAssetRequest | null) => {
  if (!request) return "";
  if (request.initialName?.trim()) return request.initialName.trim();
  return request.mediaType === "image"
    ? "图片素材"
    : request.mediaType === "video"
      ? "视频素材"
      : "音频素材";
};

const getDefaultScope = (
  request: RemoteCreateAssetRequest | null,
): AssetScope => {
  if (!request) return "personal";
  if (request.defaultScope) return request.defaultScope;
  return request.projectId ? "project" : "personal";
};

const getMediaIcon = (mediaType: MediaType, size = 18) => {
  if (mediaType === "video") return <IconVideo size={size} />;
  if (mediaType === "audio") return <IconMusic size={size} />;
  return <IconPhoto size={size} />;
};

const TAG_MAX_COUNT = 20;

export const RemoteCreateAssetDialog = ({
  open,
  request,
  onClose,
  onCreated,
}: RemoteCreateAssetDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<AssetScope>("personal");
  const [primaryCategory, setPrimaryCategory] = useState<PrimaryCategory>(
    "character",
  );
  const [categoryOptions, setCategoryOptions] = useState<AssetCategory[]>(
    FALLBACK_CATEGORY_OPTIONS,
  );
  const [personCategories, setPersonCategories] = useState<PersonCategory[]>([]);
  const [personCategoryCode, setPersonCategoryCode] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [activeTagCategoryKey, setActiveTagCategoryKey] = useState(
    ASSET_TAG_TAXONOMY[0].key,
  );
  const [tagSelectorExpanded, setTagSelectorExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const activeTagCategory =
    ASSET_TAG_TAXONOMY.find(
      (category) => category.key === activeTagCategoryKey,
    ) ?? ASSET_TAG_TAXONOMY[0];

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : current.length >= TAG_MAX_COUNT
          ? current
          : [...current, tag],
    );
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (!tag || selectedTagSet.has(tag)) {
      setCustomTag("");
      return;
    }
    if (selectedTags.length >= TAG_MAX_COUNT) {
      toast.warning(`最多可选择 ${TAG_MAX_COUNT} 个标签`);
      return;
    }
    setSelectedTags((current) => [...current, tag]);
    setCustomTag("");
  };

  // 维护 blob preview URL 的生命周期，避免内存泄漏
  useEffect(() => {
    if (!request) {
      setPreviewUrl("");
      return;
    }
    if (request.url) {
      setPreviewUrl(request.url);
      return;
    }
    if (request.blob) {
      const url = URL.createObjectURL(request.blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl("");
    return;
  }, [request]);

  // 初始化表单
  useEffect(() => {
    if (!open || !request) return;
    let cancelled = false;
    void getAssetCategories()
      .then((envelope) => {
        if (cancelled) return;
        if ((envelope.code === 0 || envelope.code === 200) && Array.isArray(envelope.data) && envelope.data.length > 0) {
          setCategoryOptions(envelope.data);
          const defaultCategory = getDefaultPrimaryCategory(request.mediaType);
          setPrimaryCategory(getAssetCategoryValueFromTree(envelope.data, defaultCategory));
        }
      })
      .catch(() => undefined);
    setName(getDefaultName(request));
    setDescription("");
    setScope(getDefaultScope(request));
    setPrimaryCategory((current) =>
      current
        ? current
        : getAssetCategoryValueFromTree(
          categoryOptions,
          getDefaultPrimaryCategory(request.mediaType),
        ),
    );
    setSelectedTags([]);
    setCustomTag("");
    setActiveTagCategoryKey(ASSET_TAG_TAXONOMY[0].key);
    setTagSelectorExpanded(true);
    setPersonCategoryCode("");
    setProgress(0);
    return () => {
      cancelled = true;
    };
  }, [open, request]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getAssetPersonCategories()
      .then((envelope) => {
        if (
          cancelled ||
          (envelope.code !== 0 && envelope.code !== 200) ||
          !Array.isArray(envelope.data)
        ) {
          return;
        }
        setPersonCategories(envelope.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 关闭时中断上传
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  if (!open || !request) return null;

  const handleSubmit = async () => {
    if (submitting) return;

    try {
      // 解析 Blob 来源
      let blob = request.blob;
      let fileName = request.fileName;
      if (!blob && request.url) {
        const defaultName =
          fileName ||
          `${name || "asset"}.${guessExtensionFromUrl(request.url) || (request.mediaType === "image" ? "png" : request.mediaType === "video" ? "mp4" : "mp3")}`;
        const fetched = await fetchBlobFromUrl(request.url, defaultName);
        blob = fetched.blob;
        fileName = fetched.fileName;
      }
      if (!blob) {
        throw new Error("没有可用的媒体数据");
      }
      if (!fileName) {
        fileName = `asset.${guessExtensionFromUrl(blob.type ? "" : request.url || "") || (request.mediaType === "image" ? "png" : request.mediaType === "video" ? "mp4" : "mp3")}`;
      }

      // 项目资产必须有 projectId
      const targetProjectId =
        scope === "project" ? request.projectId || undefined : undefined;
      if (scope === "project" && !targetProjectId) {
        toast.warning("当前画布未关联项目，无法创建项目资产");
        return;
      }
      if (scope === "company" && !personCategoryCode) {
        toast.warning("请选择公司资产的人员分类");
        return;
      }

      setSubmitting(true);
      setProgress(0);
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await uploadAndCreateAsset({
        blob,
        fileName,
        mediaType: request.mediaType,
        primaryCategory,
        scope,
        projectId: targetProjectId,
        personCategoryCode:
          scope === "company" ? personCategoryCode : undefined,
        name,
        description,
        tags: selectedTags,
        sourceProjectId: request.projectId || undefined,
        sourceNodeId: request.nodeId || undefined,
        onProgress: (percent) => setProgress(percent),
        signal: controller.signal,
      });

      toast.success("资产已创建");
      onCreated?.();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "创建资产失败";
      toast.error(message);
    } finally {
      setSubmitting(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
      <div className="noflow nodrag nopan nowheel flex max-h-[92vh] w-[min(1120px,96vw)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171719] text-white shadow-2xl">
        {/* Header */}
        <div className="flex h-13 items-center justify-between border-b border-white/8 px-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            {getMediaIcon(request.mediaType)}
            创建远程资产
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="关闭"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* Preview */}
          <div>
            <div className="mb-2 text-xs text-white/40">预览</div>
            <div className="flex aspect-4/5 items-center justify-center overflow-hidden rounded-md border border-white/8 bg-[#1c1c20]">
              {request.mediaType === "image" && previewUrl ? (
                <img
                  src={previewUrl}
                  alt={name}
                  className="h-full w-full object-contain"
                />
              ) : request.mediaType === "video" && previewUrl ? (
                <video
                  src={previewUrl}
                  className="h-full w-full object-contain"
                  controls
                  muted
                />
              ) : request.mediaType === "audio" && previewUrl ? (
                <div className="flex w-full flex-col items-center gap-3 px-4 text-white/65">
                  <IconMusic size={36} />
                  <audio src={previewUrl} className="w-full" controls />
                </div>
              ) : (
                <div className="flex flex-col items-center text-white/40">
                  {getMediaIcon(request.mediaType, 32)}
                  <span className="mt-2 text-xs">资产预览</span>
                </div>
              )}
            </div>

            {request.blob ? (
              <div className="mt-2 text-xs text-white/40">
                文件大小：{formatFileSize(request.blob.size)}
              </div>
            ) : null}
          </div>

          {/* Form */}
          <div className="flex flex-col gap-4">
            <label className="block">
              <div className="mb-1.5 text-xs text-white/45">
                名称 <span className="text-red-400">*</span>
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={255}
                disabled={submitting}
                className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#B43FEB]/70"
              />
            </label>

            <div>
              <div className="mb-1.5 text-xs text-white/45">
                范围 <span className="text-red-400">*</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SCOPE_OPTIONS.map((option) => {
                  const disabled =
                    submitting ||
                    (option.id === "project" && !request.projectId);
                  return (
                    <button
                      type="button"
                      key={option.id}
                      disabled={disabled}
                      onClick={() => setScope(option.id)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        scope === option.id
                          ? "border-[#B43FEB] bg-[#B43FEB]/15 text-white"
                          : "border-white/8 bg-white/3 text-white/65 hover:text-white",
                      )}
                    >
                      <div className="text-sm">{option.label}</div>
                      <div className="mt-0.5 text-[10px] leading-snug text-white/40">
                        {option.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {scope === "company" ? (
              <label className="block">
                <div className="mb-1.5 text-xs text-white/45">
                  人员分类 <span className="text-red-400">*</span>
                </div>
                <Select
                  value={personCategoryCode}
                  disabled={submitting}
                  onValueChange={setPersonCategoryCode}
                >
                  <SelectTrigger className="w-full border-white/10 bg-black/30 text-white/80">
                    <SelectValue placeholder="请选择人员分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {personCategories.map((category) => (
                        <SelectItem key={category.code} value={category.code}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            ) : null}

            <div>
              <div className="mb-1.5 text-xs text-white/45">
                主分类 <span className="text-red-400">*</span>
              </div>
              <AssetCategoryCascadeSelect
                categories={categoryOptions}
                value={primaryCategory}
                onChange={(value) => {
                  if (value !== "all") setPrimaryCategory(value);
                }}
                includeAll={false}
                disabled={submitting}
              />
            </div>

            <label className="block">
              <div className="mb-1.5 text-xs text-white/45">描述</div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1024}
                disabled={submitting}
                rows={2}
                className="w-full resize-none rounded-md border border-white/10 bg-black/30 p-2.5 text-sm outline-none focus:border-[#B43FEB]/70"
                placeholder="可选，最多 1024 字"
              />
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-white/45">
                <span>
                  标签 <span className="text-white/30">(最多 {TAG_MAX_COUNT} 个)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTagSelectorExpanded((current) => !current)}
                  className="flex items-center gap-1 text-white/45 hover:text-white"
                >
                  {tagSelectorExpanded ? "收起标签" : "展开标签"}
                  {tagSelectorExpanded ? (
                    <IconChevronUp size={13} />
                  ) : (
                    <IconChevronDown size={13} />
                  )}
                </button>
              </div>

              {tagSelectorExpanded ? (
                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap gap-1 rounded-md bg-white/4 p-0.5">
                    {ASSET_TAG_TAXONOMY.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        disabled={submitting}
                        onClick={() => setActiveTagCategoryKey(category.key)}
                        className={cn(
                          "rounded px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
                          activeTagCategoryKey === category.key
                            ? "bg-[#B43FEB]/25 text-white"
                            : "text-white/55 hover:text-white",
                        )}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>

                  <div className="asset-library-scrollbar mt-3 flex max-h-48 flex-col gap-2.5 overflow-y-auto pr-1">
                    {activeTagCategory.groups.length === 0 ? (
                      <span className="text-[11px] text-white/35">
                        暂无预置标签，可在下方添加自定义标签
                      </span>
                    ) : (
                      activeTagCategory.groups.map((group) => (
                        <div key={group.key} className="flex items-start gap-3">
                          <span className="mt-1 w-16 shrink-0 text-right text-[11px] leading-5 text-white/35">
                            {group.label}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            {group.tags.map((tag) => {
                              const selected = selectedTagSet.has(tag);
                              const disabled =
                                submitting ||
                                (!selected && selectedTags.length >= TAG_MAX_COUNT);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => toggleTag(tag)}
                                  className={cn(
                                    "rounded-md border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                    selected
                                      ? "border-[#B43FEB]/70 bg-[#B43FEB]/25 text-[#e0aaff]"
                                      : "border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80",
                                  )}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              <div className="mt-2 flex gap-2">
                <input
                  value={customTag}
                  onChange={(event) => setCustomTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomTag();
                    }
                  }}
                  disabled={submitting || selectedTags.length >= TAG_MAX_COUNT}
                  maxLength={64}
                  placeholder="没有合适的标签？添加一个自定义标签"
                  className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#B43FEB]/70"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting || !customTag.trim() || selectedTags.length >= TAG_MAX_COUNT}
                  onClick={addCustomTag}
                >
                  添加
                </Button>
              </div>

              {selectedTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-[#B43FEB]/15 px-2 py-0.5 text-[11px] text-[#d486ff]"
                    >
                      <IconTag size={10} />
                      {tag}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => toggleTag(tag)}
                        className="text-[#d486ff]/60 hover:text-[#d486ff] disabled:opacity-40"
                      >
                        <IconX size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-between border-t border-white/8 px-5">
          {submitting && progress > 0 ? (
            <div className="flex items-center gap-2 text-xs text-white/55">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#B43FEB] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{progress}%</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button
              size="sm"
              variant="blue"
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              创建
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
