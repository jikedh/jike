import { IconUpload, IconX } from "@tabler/icons-react";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ChangeEvent } from "react";

import { IMAGE_MODELS } from "shared/constants/ai-models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { uploadFileToOSS } from "service/oss";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { GenerationStatus } from "shared/constants/enum";
import useMessage from "@/hooks/useMessage";
import { cn } from "shared/lib/utils";
import { useCanvasFlowStore } from "@/store/canvasFlowStore";
import type { ImageGenerationNode, NoteNodeData } from "shared/types/flow";

import { COMMAND_MOCK, MENTION_MOCK } from "./mock";
import { MidjourneyAdvancedPanel } from "./components/MidjourneyAdvancedPanel";
import { MidjourneyParamsPanel } from "./components/MidjourneyParamsPanel";
import { SeedreamParamsPanel } from "./components/SeedreamParamsPanel";
import { GeminiParamsPanel } from "./components/GeminiParamsPanel";
import { PROMPT_PANEL_STYLES } from "../shared/promptPanelStyles";

const ReferenceItemWrapper = ({
  children,
  onDisconnect,
  onMouseEnter,
  onMouseLeave,
  className,
}: {
  children: React.ReactNode;
  onDisconnect?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        PROMPT_PANEL_STYLES.referenceImageButton,
        "group relative",
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {onDisconnect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-neutral-800 text-neutral-400 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100 flex items-center justify-center"
          title="断开连接"
        >
          <IconX size={10} />
        </button>
      )}
    </div>
  );
};

// 图片生成数量选项
const IMAGE_COUNT_OPTIONS = [1, 2, 4] as const;
type ImageCount = (typeof IMAGE_COUNT_OPTIONS)[number];

export const ImagePromptPanel = memo(({ nodeId }: { nodeId: string }) => {
  // 上传中态，避免重复上传触发
  const [isUploading, setIsUploading] = useState(false);
  // 图片生成数量选择
  const [imageCount, setImageCount] = useState<ImageCount>(1);
  // 正在生成的数量（用于显示进度提示）
  const [generatingCount, setGeneratingCount] = useState(0);

  const [mentionQuery, setMentionQuery] = useState("");
  const [commandQuery, setCommandQuery] = useState("");
  const [activeMode, setActiveMode] = useState<"mention" | "command" | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // 消息提示（成功/失败/警告）
  const { success, error, warning } = useMessage();

  // 画布数据：用于沿边查找父节点
  const nodes = useCanvasFlowStore((state) => state.nodes);
  const edges = useCanvasFlowStore((state) => state.edges);
  const startImageGeneration = useCanvasFlowStore(
    (state) => state.startImageGeneration,
  );
  const startGeminiPro2Generation = useCanvasFlowStore(
    (state) => state.startGeminiPro2Generation,
  );
  const stopImagePolling = useCanvasFlowStore(
    (state) => state.stopImagePolling,
  );
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge);
  const setReferenceHoverHighlight = useCanvasFlowStore(
    (state) => state.setReferenceHoverHighlight,
  );

  // 当前节点状态（用于禁用生成按钮）
  const currentNode = useMemo(() => {
    return nodes.find((node) => node.id === nodeId);
  }, [nodes, nodeId]);

  const currentImageData = useMemo(() => {
    if (!currentNode || currentNode.type !== "imageNode") {
      return null;
    }

    return currentNode.data as ImageGenerationNode;
  }, [currentNode]);

  // 从 currentImageData 获取基础字段
  const model = currentImageData?.model ?? "gemini-3-pro-image-preview";
  const platform = currentImageData?.platform;

  // 根据 model 和 platform 找到对应的模型 id
  // 新建节点时 platform 为 undefined，需要回退到只按 model 匹配
  const currentModelId = (() => {
    // 优先精确匹配 model + platform
    const matched = IMAGE_MODELS.find(
      (item) => item.model === model && item.platform === platform,
    );
    if (matched) {
      return matched.id;
    }
    // 回退：只按 model 匹配（新建节点时 platform 为 undefined）
    // 由于所有 IMAGE_MODELS 中的模型都有 platform 值，这里改为按 id 回退
    // 找不到时返回 id=3（默认的"谷歌 Gemini 3 Pro"）
    const fallback = IMAGE_MODELS.find((item) => item.model === model);
    return fallback?.id ?? 3;
  })();

  // 统一使用 size 字段存储宽高比/画面比例
  const size = currentImageData?.size ?? "1:1";
  const resolution = currentImageData?.resolution ?? "2K";
  const referenceImageUrls = currentImageData?.image_urls ?? [];
  const promptDraftHtml = currentImageData?.promptDraftHtml ?? "<p></p>";

  // ========== 模型专属参数 ==========
  // 判断是否为 Midjourney 系列模型
  const isMidjourneyModel =
    model === "midjourney" || model === "midjourney-niji7";
  // 判断是否为 Seedream 5.0 模型
  const isSeedreamModel = model === "doubao-seedream-5-0";
  // 判断是否为 Gemini 3 Pro 模型（渠道一，原有模型）
  // 兼容新建节点时 platform 为 undefined 的情况（新建节点默认回退到渠道一）
  const isGeminiModel =
    model === "gemini-3-pro-image-preview" &&
    (currentImageData?.platform === "google" ||
      currentImageData?.platform === undefined);
  // 判断是否为 Gemini 3 Pro 渠道二
  const isGeminiPro2Model = currentImageData?.platform === "google_pro2";

  // Midjourney 高级参数
  const midjourneyAdvanced = currentImageData?.midjourneyAdvanced ?? {
    referenceUrls: referenceImageUrls,
    styleUrls: [],
    iw: 1,
    sw: 100,
  };

  const resetSuggestionState = () => {
    setActiveMode(null);
    setMentionQuery("");
    setCommandQuery("");
    setActiveIndex(0);
    triggerRangeRef.current = null;
  };

  const getMentionLabel = (attrs: {
    id?: string;
    label?: string;
    value?: string;
  }) => {
    return attrs.label || attrs.value || attrs.id || "";
  };

  const disableBuiltInSuggestion = {
    items: () => [],
    render: () => ({
      onStart: () => {},
      onUpdate: () => {},
      onKeyDown: () => false,
      onExit: () => {},
    }),
  };

  const mentionExtension = useMemo(() => {
    return Mention.configure({
      deleteTriggerWithBackspace: true,
      HTMLAttributes: {
        class: "image-node-mention-pill",
      },
      renderText({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return `${options.suggestion.char}${mentionLabel}`;
      },
      renderHTML({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return [
          "span",
          {
            ...options.HTMLAttributes,
            "data-mention-id": node.attrs.id,
            "data-mention-value": node.attrs.value,
            "data-mention-label": mentionLabel,
            contenteditable: "false",
          },
          `${options.suggestion.char}${mentionLabel}`,
        ];
      },
      // 这里禁用内建 suggestion UI，改为当前组件自己的下拉面板实现
      suggestion: {
        char: "@",
        ...disableBuiltInSuggestion,
      },
    });
  }, []);

  const slashCommandExtension = useMemo(() => {
    return Mention.extend({
      name: "slashCommand",
    }).configure({
      deleteTriggerWithBackspace: true,
      HTMLAttributes: {
        class: "image-node-slash-pill",
      },
      renderText({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return `${options.suggestion.char}${mentionLabel}`;
      },
      renderHTML({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
        return [
          "span",
          {
            ...options.HTMLAttributes,
            "data-mention-id": node.attrs.id,
            "data-mention-value": node.attrs.value,
            "data-mention-label": mentionLabel,
            contenteditable: "false",
          },
          `${options.suggestion.char}${mentionLabel}`,
        ];
      },
      suggestion: {
        char: "/",
        ...disableBuiltInSuggestion,
      },
    });
  }, []);

  // 用于粗粒度识别当前触发词位置，便于替换 @xxx 或 /xxx
  const triggerRangeRef = useRef<{ from: number; to: number } | null>(null);
  // 上传按钮对应的隐藏 input
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 建议面板容器 ref
  const suggestionPanelRef = useRef<HTMLDivElement | null>(null);

  const insertSuggestionNode = (
    mode: "mention" | "command",
    item: (typeof MENTION_MOCK)[number] | (typeof COMMAND_MOCK)[number],
  ) => {
    if (!triggerRangeRef.current) {
      return;
    }

    if (mode === "mention") {
      const selected = item as (typeof MENTION_MOCK)[number];
      editor
        ?.chain()
        .focus()
        .insertContentAt(triggerRangeRef.current, [
          {
            type: "mention",
            attrs: {
              id: selected.id,
              label: selected.label,
              value: selected.value,
            },
          },
          {
            type: "text",
            text: " ",
          },
        ])
        .run();
      return;
    }

    const selected = item as (typeof COMMAND_MOCK)[number];

    // 根据命令自动设置 size
    const commandSizeMap: Record<string, string> = {
      "c-1": "4:3", // 角色参考图
      "c-2": "21:9", // 角色三视图
      "c-3": "16:9", // 多宫格电影分镜
      "c-4": "21:9", // VR图
    };
    const targetSize = commandSizeMap[selected.id];
    if (targetSize) {
      updateImageNodeData(nodeId, { size: targetSize });
    }

    // 根据命令自动设置 resolution
    const commandResolutionMap: Record<string, string> = {
      "c-3": "1K", // 多宫格电影分镜
      "c-4": isGeminiModel ? "4K" : "3K", // VR图：Gemini用4K，Seedream用3K
    };
    const targetResolution = commandResolutionMap[selected.id];
    if (targetResolution) {
      updateImageNodeData(nodeId, { resolution: targetResolution });
    }

    // 只插入 description 作为文本，不再插入 slashCommand 节点显示 label
    editor
      ?.chain()
      .focus()
      .insertContentAt(triggerRangeRef.current, [
        {
          type: "text",
          text: selected.description,
        },
      ])
      .run();
  };

  const filteredMentionItems = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const all = [...MENTION_MOCK];
    if (!q) {
      return all;
    }
    return all.filter((item) => {
      return (
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [mentionQuery]);

  const filteredCommandItems = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    const all = [...COMMAND_MOCK];
    if (!q) {
      return all;
    }
    return all.filter((item) => {
      return (
        item.label.toLowerCase().includes(q) ||
        item.command.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [commandQuery]);

  // 沿着边找所有父节点，并合并其第一张图片作为参考图来源
  const parentImageNodes = useMemo(() => {
    const parentIds = edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => edge.source);

    if (parentIds.length === 0) {
      return [] as {
        id: string;
        url: string;
        relativePath?: string;
        fileName?: string;
      }[];
    }

    const result: {
      id: string;
      url: string;
      relativePath?: string;
      fileName?: string;
    }[] = [];

    parentIds.forEach((parentId) => {
      const parentNode = nodes.find((node) => node.id === parentId);
      if (!parentNode || parentNode.type !== "imageNode") {
        return;
      }

      const parentData = parentNode.data as ImageGenerationNode;
      const firstItem = parentData.result?.data?.[0];
      if (firstItem?.url) {
        result.push({
          id: parentId,
          url: firstItem.url,
          relativePath: firstItem.relativePath,
          fileName: firstItem.localFileName,
        });
      }
    });

    return result;
  }, [edges, nodes, nodeId]);

  const parentImageUrls = useMemo(
    () => parentImageNodes.map((item) => item.url),
    [parentImageNodes],
  );

  // 断开连接时，同步清理 midjourneyAdvanced 中的 URL
  const handleDisconnectNode = useCallback(
    (sourceNodeId: string) => {
      const edgeToDelete = edges.find(
        (edge) => edge.source === sourceNodeId && edge.target === nodeId,
      );
      if (edgeToDelete) {
        deleteEdge(edgeToDelete.id);
      }

      // 从 midjourneyAdvanced 中移除断开连接的父节点图片
      // 通过 nodes 直接查找父节点，获取其第一张结果图的 URL
      const parentNode = nodes.find((node) => node.id === sourceNodeId);
      if (parentNode && parentNode.type === "imageNode") {
        const parentData = parentNode.data as ImageGenerationNode;
        const firstItem = parentData.result?.data?.[0];
        if (firstItem?.url) {
          const urlToRemove = firstItem.url;
          // 直接从最新的 nodes 状态中获取当前的 midjourneyAdvanced，避免依赖旧状态
          const currentNodeData = nodes.find((n) => n.id === nodeId);
          const currentAdvanced = (currentNodeData?.data as ImageGenerationNode)
            ?.midjourneyAdvanced;
          if (currentAdvanced) {
            const newReferenceUrls = (
              currentAdvanced.referenceUrls ?? []
            ).filter((url) => url !== urlToRemove);
            const newStyleUrls = (currentAdvanced.styleUrls ?? []).filter(
              (url) => url !== urlToRemove,
            );
            updateImageNodeData(nodeId, {
              midjourneyAdvanced: {
                ...currentAdvanced,
                referenceUrls: newReferenceUrls,
                styleUrls: newStyleUrls,
              },
            });
          }
        }
      }
    },
    [edges, nodeId, deleteEdge, nodes, updateImageNodeData],
  );

  // 收集父级便签内容：按入边顺序去重后提取 content
  const parentNoteContents = useMemo(() => {
    const orderedParentIds: string[] = [];
    const seenParentIds = new Set<string>();

    edges.forEach((edge) => {
      if (edge.target !== nodeId || seenParentIds.has(edge.source)) {
        return;
      }

      seenParentIds.add(edge.source);
      orderedParentIds.push(edge.source);
    });

    return orderedParentIds
      .map((parentId) => nodes.find((node) => node.id === parentId))
      .filter((node) => node?.type === "noteNode")
      .map((node) => (node?.data as NoteNodeData).content?.trim())
      .filter((content) => Boolean(content)) as string[];
  }, [edges, nodes, nodeId]);

  useEffect(() => {
    if (parentImageUrls.length === 0) {
      return;
    }

    const currentUrls = referenceImageUrls;
    const nextUrls = Array.from(new Set([...currentUrls, ...parentImageUrls]));

    const currentSet = new Set(currentUrls);
    const nextSet = new Set(nextUrls);

    const unchanged =
      currentSet.size === nextSet.size &&
      [...currentSet].every((url) => nextSet.has(url));

    if (unchanged) {
      return;
    }

    updateImageNodeData(nodeId, {
      image_urls: nextUrls,
    });
  }, [referenceImageUrls, nodeId, parentImageUrls, updateImageNodeData]);

  // 是否正在生成（用于按钮禁用态）
  const isGenerating = useMemo(() => {
    if (!currentNode || currentNode.type !== "imageNode") {
      return false;
    }

    const status = currentNode.data.status;
    return (
      status === GenerationStatus.IN_PROGRESS ||
      status === GenerationStatus.QUEUED
    );
  }, [currentNode]);

  // 触发上传选择
  const handleUploadClick = () => {
    if (isUploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  // 上传图片并回填到参image_urls: [...referenceImage
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      // 检查文件大小，大于10MB时压缩
      let fileToUpload = file;
      if (file.size > MAX_IMAGE_SIZE_MB) {
        fileToUpload = await compressImage(file);
      }

      const result = await uploadFileToOSS(fileToUpload);
      const nextUrl = result.url;

      if (!nextUrl) {
        warning("上传成功但未返回图片地址");
        return;
      }

      updateImageNodeData(nodeId, {
        image_urls: [...referenceImageUrls, nextUrl],
      });
      success("上传成功");
    } catch (uploadError) {
      console.error("上传图片失败:", uploadError);
      error("上传失败，请重试");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const editor = useEditor({
    extensions: [StarterKit, mentionExtension, slashCommandExtension],
    content: promptDraftHtml,
    editorProps: {
      attributes: {
        class: cn(
          "nodrag nopan nowheel min-h-[88px] max-h-[220px] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900/85 px-3 py-2 text-sm leading-6 text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] cursor-text",
          "focus:outline-none",
        ),
      },
      handleKeyDown: (_view, event) => {
        // 当焦点在图片提示词输入区时，空格仅用于输入，不向画布层冒泡。
        if (event.code === "Space" || event.key === " ") {
          event.stopPropagation();
          // 返回 false 让 TipTap 保持默认输入空格字符的行为。
          return false;
        }

        const currentItems =
          activeMode === "mention"
            ? filteredMentionItems
            : filteredCommandItems;

        if (!activeMode || currentItems.length === 0) {
          return false;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((prev) => (prev + 1) % currentItems.length);
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex(
            (prev) => (prev - 1 + currentItems.length) % currentItems.length,
          );
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          resetSuggestionState();
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          if (activeMode === "mention") {
            const selected = filteredMentionItems[activeIndex];
            if (!selected) {
              return true;
            }

            insertSuggestionNode("mention", selected);
          }

          if (activeMode === "command") {
            const selected = filteredCommandItems[activeIndex];
            if (!selected) {
              return true;
            }

            insertSuggestionNode("command", selected);
          }

          resetSuggestionState();
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      updateImageNodeData(nodeId, {
        promptDraft: currentEditor.getText(),
        promptDraftHtml: currentEditor.getHTML(),
      });

      const { from } = currentEditor.state.selection;
      const plainText = currentEditor.state.doc.textBetween(
        0,
        from,
        "\n",
        "\0",
      );
      const mentionMatch = plainText.match(/(^|\s)@([^\s@]*)$/);
      const commandMatch = plainText.match(/(^|\s)\/([^\s/]*)$/);

      if (mentionMatch) {
        setActiveMode("mention");
        setMentionQuery(mentionMatch[2] ?? "");
        setCommandQuery("");
        setActiveIndex(0);

        const triggerLength = `@${mentionMatch[2] ?? ""}`.length;
        triggerRangeRef.current = {
          from: Math.max(from - triggerLength, 0),
          to: from,
        };
        return;
      }

      if (commandMatch) {
        setActiveMode("command");
        setCommandQuery(commandMatch[2] ?? "");
        setMentionQuery("");
        setActiveIndex(0);

        const triggerLength = `/${commandMatch[2] ?? ""}`.length;
        triggerRangeRef.current = {
          from: Math.max(from - triggerLength, 0),
          to: from,
        };
        return;
      }

      resetSuggestionState();
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentHtml = editor.getHTML();
    if (currentHtml === promptDraftHtml) {
      return;
    }

    editor.commands.setContent(promptDraftHtml, { emitUpdate: false });
  }, [editor, promptDraftHtml]);

  const suggestionItems =
    activeMode === "mention" ? filteredMentionItems : filteredCommandItems;

  // 当 activeIndex 改变时，自动滚动到选中的选项
  useEffect(() => {
    if (
      suggestionPanelRef.current &&
      activeMode &&
      suggestionItems.length > 0
    ) {
      const activeElement = suggestionPanelRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeIndex, activeMode, suggestionItems.length]);

  // 点击生成：根据数量多次调用接口创建任务
  const handleGenerate = async () => {
    const promptText = editor?.getText().trim() ?? "";
    const mergedPrompt = [...parentNoteContents, promptText]
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .join(" ");

    if (!mergedPrompt) {
      warning("请输入提示词");
      return;
    }

    // 判断是否为 Midjourney Niji7 模型，如果是则在 prompt 最后拼接 --niji7 参数
    const isNiji7Model = model === "midjourney-niji7";
    // 构建 Midjourney 模型的最终 prompt：添加 --ar 参数
    let finalPrompt = mergedPrompt;
    if (isMidjourneyModel) {
      // Midjourney 模型：在 prompt 末尾拼接 --ar 尺寸参数
      finalPrompt = `${finalPrompt} --ar ${size}`;
      // 如果是 Niji7 模型，还需要拼接 --niji 7
      if (isNiji7Model) {
        finalPrompt = `${finalPrompt} --niji 7`;
      }
    }
    // Gemini 3 Pro 渠道二：在 prompt 末尾拼接 [尺寸:x:x] [分辨率:xK] 参数
    if (isGeminiPro2Model) {
      finalPrompt = `${finalPrompt} [尺寸:${size}] [分辨率:${resolution}]`;
    }
    // 发送给后端的 model 字段：如果是 midjourney-niji7 则改为 midjourney
    const backendModel = isNiji7Model ? "midjourney" : model;

    // image_urls 直接使用界面当前显示的参考图列表（上传 + 父节点结果）
    // 所有图片在上传时已经上传到 OSS，或是在线 URL，直接使用即可
    const imageUrls = referenceImageUrls;

    // 构建请求 payload
    const buildPayload = (): any => {
      // 基础 payload
      const basePayload: any = {
        // 请求使用 backendModel（后端统一使用 midjourney，Niji7 效果通过 prompt 参数控制）
        model: backendModel,
        // 保留原始 model 用于 UI 状态同步
        originalModel: model,
        prompt: finalPrompt,
        resolution,
        n: 1,
        image_urls: imageUrls,
        promptDraft: editor?.getText() ?? "",
        promptDraftHtml: editor?.getHTML() ?? "<p></p>",
        metadata: {},
      };

      // 根据不同模型添加专属参数
      if (isSeedreamModel) {
        // Seedream 5.0: size 作为宽高比
        basePayload.size = size;
        basePayload.metadata = {
          resolution,
        };
      } else if (isGeminiModel) {
        // Gemini 3 Pro: size 作为画面比例
        basePayload.size = size;
        basePayload.metadata = {
          resolution,
        };
      } else {
        // 其他模型（Midjourney 等）
        basePayload.size = size;
        basePayload.aspectRatio = currentImageData?.aspectRatio ?? "1:1";
        basePayload.metadata = {
          resolution,
        };
        if (isMidjourneyModel) {
          basePayload.midjourneyAdvanced = midjourneyAdvanced;
        }
      }

      return basePayload;
    };

    // 显示总共需要生成的图片数量
    setGeneratingCount(imageCount);

    // 记录成功和失败的数量
    let successCount = 0;
    let failCount = 0;

    // Gemini 3 Pro 渠道二：直接调用专用接口（无需轮询）
    if (isGeminiPro2Model) {
      for (let i = 0; i < imageCount; i++) {
        try {
          const payload = buildPayload();
          // 渠道二使用独立接口
          await startGeminiPro2Generation(nodeId, {
            ...payload,
            platform: "google_pro2", // 标识渠道二
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
    } else {
      // 多次调用接口，每次只生成 1 张图片
      for (let i = 0; i < imageCount; i++) {
        try {
          await startImageGeneration(nodeId, buildPayload());
          successCount++;
        } catch {
          // 错误已由全局拦截器处理并在 ImageContent 中展示，此处不需要重复弹窗
          failCount++;
        }
      }
    }

    // 重置进度显示
    setGeneratingCount(0);

    // 根据结果显示提示
    if (failCount === 0) {
      success(`已开始生成 ${successCount} 张图片`);
    } else if (successCount > 0) {
      warning(`已创建 ${successCount} 张图片，${failCount} 张创建失败`);
    } else {
      error("创建任务失败，请稍后再试");
    }
  };

  /**
   * 停止正在进行的图片生成轮询。
   */
  const handleStop = useCallback(() => {
    if (!isGenerating) return;
    stopImagePolling(nodeId);
    // 重置节点状态为完成，清除进度和结果
    updateImageNodeData(nodeId, {
      status: GenerationStatus.COMPLETED,
      progress: 0,
      result: undefined,
      error: undefined,
    });
    success("已停止生成");
  }, [isGenerating, stopImagePolling, nodeId, success, updateImageNodeData]);

  return (
    <div
      className={PROMPT_PANEL_STYLES.container}
      style={{ pointerEvents: "auto" }}
    >
      {/* 顶部区域：tiptap 增强输入区 */}
      <div className={PROMPT_PANEL_STYLES.inputArea}>
        <EditorContent editor={editor} />
        <div className="nodrag nopan nowheel flex gap-2 overflow-x-auto pb-1 mt-2.5">
          {/* 上传按钮（固定为第一个） */}
          <Button
            unstyled
            className={PROMPT_PANEL_STYLES.uploadButton}
            onClick={handleUploadClick}
            title={isUploading ? "上传中..." : "上传参考图"}
            disabled={isUploading}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px]">
              <IconUpload size={16} />
              {isUploading ? "上传中" : "上传"}
            </div>
          </Button>

          {/* 隐藏 input，用于触发文件选择 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 参考图（上传 + 父节点结果） */}
          {referenceImageUrls.map((url, index) => {
            const parentNode = parentImageNodes.find(
              (item) => item.url === url,
            );
            return (
              <ReferenceItemWrapper
                key={`${url}-${index}`}
                onDisconnect={
                  parentNode
                    ? () => handleDisconnectNode(parentNode.id)
                    : undefined
                }
                onMouseEnter={() => {
                  if (!parentNode) {
                    return;
                  }

                  setReferenceHoverHighlight(parentNode.id, nodeId, true);
                }}
                onMouseLeave={() => {
                  if (!parentNode) {
                    return;
                  }

                  setReferenceHoverHighlight(parentNode.id, nodeId, false);
                }}
              >
                <img
                  src={url}
                  alt="参考图"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
              </ReferenceItemWrapper>
            );
          })}
        </div>
        {/* 建议面板 */}
        {activeMode && suggestionItems.length > 0 && (
          <div
            ref={suggestionPanelRef}
            className="nodrag nopan nowheel absolute right-2 bottom-full left-2 z-30 mb-5 max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
          >
            {suggestionItems.map((item, index) => {
              const isActive = index === activeIndex;
              const title = item.label;
              const desc = item.description;
              const token =
                activeMode === "mention" ? `@${item.value}` : item.command;

              return (
                <Button
                  key={item.id}
                  unstyled
                  className={cn(
                    "flex w-full items-start justify-between gap-3 border-b border-neutral-800 px-3 py-2 text-left last:border-b-0",
                    isActive
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-200 hover:bg-neutral-800",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setActiveIndex(index);

                    if (!triggerRangeRef.current) {
                      return;
                    }

                    if (activeMode === "mention") {
                      insertSuggestionNode("mention", item);
                    } else {
                      insertSuggestionNode("command", item);
                    }

                    resetSuggestionState();
                  }}
                >
                  <div>
                    <div className="text-xs font-medium">{title}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      {desc}
                    </div>
                  </div>
                  <span className="rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                    {token}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* 下方区域：参数控制区 */}
      <div className="rounded-xl border border-white/6 bg-white/2 p-2.5">
        <div className="flex items-center gap-2">
          {/* 生成模型 - 始终在最左侧 */}
          <Select
            value={String(currentModelId)}
            onValueChange={(value) => {
              // 通过 id 精确查找模型配置
              const selectedModel = IMAGE_MODELS.find(
                (item) => item.id === Number(value),
              );
              updateImageNodeData(nodeId, {
                model: selectedModel?.model ?? value,
                platform: selectedModel?.platform,
              });
            }}
          >
            <SelectTrigger className={PROMPT_PANEL_STYLES.modelSelect}>
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
              {IMAGE_MODELS.map((item) => (
                <SelectItem
                  key={item.id}
                  value={String(item.id)}
                  className={PROMPT_PANEL_STYLES.modelSelectItem}
                >
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 根据模型动态渲染整合参数面板 */}
          {isSeedreamModel && (
            // Seedream 5.0 整合参数面板
            <SeedreamParamsPanel
              size={size}
              resolution={resolution}
              onSizeChange={(value) =>
                updateImageNodeData(nodeId, { size: value })
              }
              onResolutionChange={(value) =>
                updateImageNodeData(nodeId, { resolution: value })
              }
            />
          )}
          {isGeminiModel && (
            // Gemini 3 Pro 整合参数面板
            <GeminiParamsPanel
              size={size}
              resolution={resolution}
              onSizeChange={(value) =>
                updateImageNodeData(nodeId, { size: value })
              }
              onResolutionChange={(value) =>
                updateImageNodeData(nodeId, { resolution: value })
              }
            />
          )}
          {isGeminiPro2Model && (
            // Gemini 3 Pro 渠道二整合参数面板（参数拼接到提示词）
            <GeminiParamsPanel
              size={size}
              resolution={resolution}
              onSizeChange={(value) =>
                updateImageNodeData(nodeId, { size: value })
              }
              onResolutionChange={(value) =>
                updateImageNodeData(nodeId, { resolution: value })
              }
            />
          )}

          {/* Midjourney 整合参数面板 - 仅在选择 Midjourney 模型时显示 */}
          {isMidjourneyModel && (
            <MidjourneyParamsPanel
              size={size}
              onSizeChange={(value) =>
                updateImageNodeData(nodeId, { size: value })
              }
            />
          )}

          {/* Midjourney 高级选项 - 仅在选择 Midjourney 模型时显示 */}
          {isMidjourneyModel && (
            <MidjourneyAdvancedPanel
              referenceImageUrls={referenceImageUrls}
              value={midjourneyAdvanced}
              onChange={(next) => {
                updateImageNodeData(nodeId, {
                  midjourneyAdvanced: {
                    referenceUrls: next.referenceUrls ?? [],
                    styleUrls: next.styleUrls ?? [],
                    iw: next.iw ?? 1,
                    sw: next.sw ?? 100,
                  },
                });
              }}
            />
          )}

          {/* 数量选择和生成按钮 */}
          <div className="ml-auto flex items-center gap-2">
            {/* 数量选择按钮 - Midjourney 模型隐藏 */}
            {!isMidjourneyModel && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = IMAGE_COUNT_OPTIONS.indexOf(imageCount);
                  const nextIndex =
                    (currentIndex + 1) % IMAGE_COUNT_OPTIONS.length;
                  setImageCount(IMAGE_COUNT_OPTIONS[nextIndex]);
                }}
                disabled={isGenerating}
                className={cn(
                  PROMPT_PANEL_STYLES.countButton,
                  isGenerating && "opacity-50 cursor-not-allowed",
                )}
                title={`当前生成 ${imageCount} 张图片，点击切换`}
              >
                <span>×</span>
                <span>{imageCount}</span>
              </button>
            )}

            {/* 生成/停止按钮 */}
            {isGenerating ? (
              <Button
                type="button"
                unstyled
                className={PROMPT_PANEL_STYLES.stopButton}
                onClick={handleStop}
              >
                停止
              </Button>
            ) : (
              <Button
                type="button"
                unstyled
                className={PROMPT_PANEL_STYLES.generateButton}
                onClick={handleGenerate}
                disabled={isUploading}
              >
                {generatingCount > 0 ? `生成中 (${generatingCount})` : "生成"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ImagePromptPanel.displayName = "ImagePromptPanel";
