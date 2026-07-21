import Mention from "@tiptap/extension-mention";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  forwardRef,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  cn,
  getMentionLabel,
  updateSuggestionPosition,
} from "shared/utils/utils";

const escapeHtmlFallback = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
import { PROMPT_PANEL_STYLES } from "../../shared/promptPanelStyles";
import { AssetMentionMenu } from "../../shared/AssetMentionMenu";
import {
  isAssetMentionFile,
  isAssetMentionFolder,
  type MentionAssetOption,
} from "../../shared/assetMentionTypes";
import { useAssetMentionMenu } from "../../shared/useAssetMentionMenu";
import { MentionList } from "./MentionList";

export interface VideoPromptEditorHandle {
  getPlainText: () => string;
  /** 获取 TipTap ProseMirror doc 的 JSON 结构，供归一化系统读取 mention 节点 */
  getDocumentJSON: () => unknown | null;
  insertContent: (content: string) => void;
  removeReferenceMentions: (
    matchers: Array<{
      ids?: string[];
      thumbnail?: string;
      type?: "image" | "video" | "audio";
    }>,
  ) => number;
  updateReferenceMentions: (
    updates: Array<{
      id: string;
      label: string;
      originalLabel?: string;
      value?: string;
      thumbnail?: string;
      url?: string;
      fileUrl?: string;
      source?: string;
      scope?: string;
      assetId?: string;
      nodeId?: string;
      primaryCategory?: string;
      category?: string;
      type?: "image" | "video" | "audio";
      mediaType?: "image" | "video" | "audio";
    }>,
  ) => number;
  /**
   * 把普通文本回填进编辑器，同时保留所有原有的 mention 节点 attrs，
   * 供“优化提示词”功能使用，避免回写后丢失媒体资产字段。
   */
  replaceTextPreservingMentions: (nextText: string) => void;
}

export interface VideoPromptEditorProps {
  promptDraftHtml: string;
  /** 优化提示词等异步操作期间，锁定正文以避免回写覆盖用户输入。 */
  isEditable?: boolean;
  nodeId?: string;
  projectId?: string | null;
  mentionItems: {
    id: string;
    label: string;
    originalLabel?: string;
    value: string;
    thumbnail: string;
    type: "image" | "video" | "audio";
    mediaType?: "image" | "video" | "audio";
    url?: string;
    fileUrl?: string;
    source?: string;
    scope?: string;
    category?: string;
    primaryCategory?: string;
    assetId?: string;
    nodeId?: string;
  }[];
  onDraftChange: (payload: { text: string; html: string }) => void;
}

interface AssetMentionSuggestionProps {
  nodeId: string;
  projectId?: string | null;
  command: (item: Record<string, unknown>) => void;
}

interface AssetMentionSuggestionHandle {
  onKeyDown: (payload: { event: KeyboardEvent }) => boolean;
}

const toMentionCommandPayload = (option: MentionAssetOption) => ({
  id: option.nodeId || option.assetId || option.id,
  label: option.label,
  displayLabel: option.label,
  originalLabel: option.label,
  value: option.value || option.label,
  thumbnail: option.thumbnailUrl || option.fileUrl,
  type: option.mediaType,
  mediaType: option.mediaType,
  source: option.source,
  scope: option.scope,
  assetId: option.assetId,
  nodeId: option.nodeId,
  primaryCategory: option.primaryCategory,
  category: option.primaryCategory,
  url: option.fileUrl,
  fileUrl: option.fileUrl,
});

const buildLegacyMentionListItems = (items: Array<Record<string, unknown>>) =>
  items.map((item) => ({
    ...item,
    originalLabel:
      (item.originalLabel as string | undefined) ??
      (item.label as string | undefined),
  }));

const AssetMentionSuggestion = forwardRef<
  AssetMentionSuggestionHandle,
  AssetMentionSuggestionProps
>(({ nodeId, projectId, command }, ref) => {
  const menu = useAssetMentionMenu({
    nodeId,
    projectId,
  });

  const selectOption = (option: MentionAssetOption | null) => {
    if (!option || option.disabled) return;
    // 目录只改变资产选择器的当前位置，绝不能被写入提示词。
    if (isAssetMentionFolder(option)) {
      menu.activateOption(option);
      return;
    }
    if (!isAssetMentionFile(option)) return;
    command(toMentionCommandPayload(option));
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        menu.moveSelection(-1);
        return true;
      }

      if (event.key === "ArrowDown") {
        menu.moveSelection(1);
        return true;
      }

      if (event.key === "Enter") {
        selectOption(menu.selectCurrent());
        return true;
      }

      return false;
    },
  }));

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      menu.moveSelection(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      menu.moveSelection(1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectOption(menu.selectCurrent());
    }
  };

  return (
    <AssetMentionMenu
      query={menu.query}
      groups={menu.groups}
      selectedKey={menu.selectedKey}
      loading={menu.loading}
      error={menu.error}
      breadcrumbs={menu.breadcrumbs}
      canGoBack={menu.canGoBack}
      autoFocus
      onQueryChange={menu.setQuery}
      onSelect={selectOption}
      onHoverOption={menu.setSelectedByKey}
      onInputKeyDown={handleInputKeyDown}
      onBack={menu.goBack}
    />
  );
});

AssetMentionSuggestion.displayName = "AssetMentionSuggestion";

export const VideoPromptEditor = forwardRef<
  VideoPromptEditorHandle,
  VideoPromptEditorProps
>(
  (
    {
      promptDraftHtml,
      isEditable = true,
      nodeId,
      projectId,
      mentionItems,
      onDraftChange,
    },
    ref,
  ) => {
  const mentionItemsRef = useRef(mentionItems);
  const nodeIdRef = useRef(nodeId);
  const projectIdRef = useRef(projectId);
  const [preview, setPreview] = useState<{
    src: string;
    label: string;
    left: number;
    top: number;
    type?: "image" | "video";
  } | null>(null);

  useEffect(() => {
    mentionItemsRef.current = mentionItems;
  }, [mentionItems]);

  useEffect(() => {
    nodeIdRef.current = nodeId;
    projectIdRef.current = projectId;
  }, [nodeId, projectId]);

  const mentionExtension = useMemo(() => {
    return Mention.extend({
      parseHTML() {
        return [
          {
            tag: "span[data-mention-id]",
          },
        ];
      },
      addAttributes() {
        return {
          ...this.parent?.(),
          thumbnail: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-thumbnail"),
            renderHTML: (attributes) => {
              if (!attributes.thumbnail) {
                return {};
              }
              return {
                "data-thumbnail": attributes.thumbnail,
              };
            },
          },
          // 原始图片名称（节点昵称 / 文件名 / 类型默认名），仅用于 UI 展示与悬浮提示。
          originalLabel: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-mention-original-label"),
            renderHTML: (attributes) => {
              if (!attributes.originalLabel) {
                return {};
              }
              return {
                "data-mention-original-label": attributes.originalLabel,
              };
            },
          },
          // 实际拼接到 Prompt 的固定文本（"图片一/图片二…"）。
          displayLabel: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-mention-display-label"),
            renderHTML: (attributes) => {
              if (!attributes.displayLabel) {
                return {};
              }
              return {
                "data-mention-display-label": attributes.displayLabel,
              };
            },
          },
          type: {
            default: "image",
            parseHTML: (element) => {
              const mentionKind = element.getAttribute("data-mention-kind");
              if (mentionKind) {
                return mentionKind;
              }

              const mediaTypeAttr = element.getAttribute("data-media-type");
              if (mediaTypeAttr) {
                return mediaTypeAttr;
              }

              const legacyType = element.getAttribute("data-type");
              if (legacyType && legacyType !== "mention") {
                return legacyType;
              }

              return "image";
            },
            renderHTML: (attributes) => {
              return {
                "data-mention-kind": attributes.type || "image",
              };
            },
          },
          source: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-mention-source"),
            renderHTML: (attributes) => {
              if (!attributes.source) return {};
              return { "data-mention-source": attributes.source };
            },
          },
          scope: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-mention-scope"),
            renderHTML: (attributes) => {
              if (!attributes.scope) return {};
              return { "data-mention-scope": attributes.scope };
            },
          },
          assetId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-asset-id"),
            renderHTML: (attributes) => {
              if (!attributes.assetId) return {};
              return { "data-asset-id": attributes.assetId };
            },
          },
          nodeId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-node-id"),
            renderHTML: (attributes) => {
              if (!attributes.nodeId) return {};
              return { "data-node-id": attributes.nodeId };
            },
          },
          primaryCategory: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-primary-category"),
            renderHTML: (attributes) => {
              if (!attributes.primaryCategory) return {};
              return { "data-primary-category": attributes.primaryCategory };
            },
          },
          fileUrl: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-file-url"),
            renderHTML: (attributes) => {
              if (!attributes.fileUrl) return {};
              return { "data-file-url": attributes.fileUrl };
            },
          },
          // 与 type 等价的另一份媒体类型字段，便于内容回写和后续归一化识别。
          mediaType: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-media-type"),
            renderHTML: (attributes) => {
              if (!attributes.mediaType) return {};
              return { "data-media-type": attributes.mediaType };
            },
          },
          // 媒体真实 URL，可能与 fileUrl / thumbnail 不同；提交归一化优先用它。
          url: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-url"),
            renderHTML: (attributes) => {
              if (!attributes.url) return {};
              return { "data-url": attributes.url };
            },
          },
          // 资产主分类，兼容 primaryCategory。
          category: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-category"),
            renderHTML: (attributes) => {
              if (!attributes.category) return {};
              return { "data-category": attributes.category };
            },
          },
        };
      },
      draggable: true,
    }).configure({
      deleteTriggerWithBackspace: true,
      HTMLAttributes: {
        class: "video-node-mention-pill",
        draggable: "true",
      },
      renderText({ node }) {
        // getText() 输出的纯文本必须使用 displayLabel（中文数字），
        // 这样 editor.getText() 拼接到 Prompt 时始终是"图片一/图片二…"。
        const displayLabel =
          (node.attrs.displayLabel as string | null | undefined) ??
          getMentionLabel(node.attrs);
        return displayLabel;
      },
      renderHTML({ options, node }) {
        const fallbackLabel = getMentionLabel(node.attrs);
        // Pill 上展示的文本始终是 displayLabel，与 Prompt 拼接文本保持一致。
        const mentionLabel =
          (node.attrs.displayLabel as string | null | undefined) ||
          fallbackLabel;
        const originalLabel =
          (node.attrs.originalLabel as string | null | undefined) ||
          fallbackLabel;
        const thumbnail = node.attrs.thumbnail as string | undefined;
        const mentionType = node.attrs.type as
          | "image"
          | "video"
          | "audio"
          | undefined;

        const children: any[] = [];

        if (mentionType === "audio") {
          children.push([
            "span",
            {
              class: "video-node-mention-pill__audio-icon",
            },
            "🎵",
          ]);
        } else if (thumbnail) {
          children.push([
            "img",
            {
              class: "video-node-mention-pill__thumbnail",
              src: thumbnail,
              alt: originalLabel,
              title: originalLabel,
              draggable: "false",
            },
          ]);
        }

        children.push([
          "span",
          { class: "video-node-mention-pill__label" },
          mentionLabel,
        ]);

        return [
          "span",
          {
            ...options.HTMLAttributes,
            class: cn(
              options.HTMLAttributes.class,
              mentionType === "image" && thumbnail && "cursor-pointer",
            ),
            "data-type": "mention",
            "data-mention-id": node.attrs.id,
            "data-mention-value": node.attrs.value,
            "data-mention-label": mentionLabel,
            "data-mention-display-label": mentionLabel,
            "data-mention-original-label": originalLabel,
            "data-mention-kind": mentionType || "image",
            "data-media-type": node.attrs.mediaType || mentionType || "image",
            "data-thumbnail": thumbnail,
            "data-mention-source": node.attrs.source,
            "data-mention-scope": node.attrs.scope,
            "data-asset-id": node.attrs.assetId,
            "data-node-id": node.attrs.nodeId,
            "data-primary-category": node.attrs.primaryCategory,
            "data-category":
              node.attrs.category || node.attrs.primaryCategory,
            "data-url": node.attrs.url || node.attrs.fileUrl,
            "data-file-url": node.attrs.fileUrl,
            contenteditable: "false",
            draggable: "true",
            title: originalLabel,
          },
          ...children,
        ];
      },
      suggestion: {
        char: "@",
        allowSpaces: true,
        allowedPrefixes: null,
        startOfLine: false,
        findSuggestionMatch: ({ $position }) => {
          const textBeforeCursor =
            $position.nodeBefore?.isText && $position.nodeBefore.text;

          if (!textBeforeCursor || !textBeforeCursor.endsWith("@")) {
            return null;
          }

          return {
            range: {
              from: $position.pos - 1,
              to: $position.pos,
            },
            query: "",
            text: "@",
          };
        },
        allow: ({ state, range }) => {
          const { from, to } = state.selection;

          if (from !== to) {
            return false;
          }

          return state.doc.textBetween(to - 1, to, "", "") === "@";
        },
        items: () => {
          return mentionItemsRef.current;
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let keyboardHandler: ((event: KeyboardEvent) => void) | null = null;
          let editorDom: HTMLElement | null = null;

          return {
            onStart: (props) => {
              if (!props.clientRect) {
                return;
              }

              editorDom = props.editor.view.dom;

              if (nodeIdRef.current) {
                component = new ReactRenderer(AssetMentionSuggestion, {
                  props: {
                    nodeId: nodeIdRef.current,
                    projectId: projectIdRef.current,
                    command: (item: any) => {
                      props.command(item);
                    },
                  },
                  editor: props.editor,
                });
              } else {
                component = new ReactRenderer(MentionList, {
                  props: {
                    ...props,
                    items: buildLegacyMentionListItems(
                      props.items as Array<Record<string, unknown>>,
                    ),
                    command: (item: any) => {
                      props.command(item);
                    },
                  },
                  editor: props.editor,
                });
              }

              component.element.style.position = "absolute";
              component.element.style.zIndex = "9999";

              document.body.appendChild(component.element);

              updateSuggestionPosition(props.editor, component.element);

              keyboardHandler = (event: KeyboardEvent) => {
                const handled = (
                  component?.ref as {
                    onKeyDown?: (payload: { event: KeyboardEvent }) => boolean;
                  }
                )?.onKeyDown?.({ event });
                if (handled) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              };
              editorDom.addEventListener("keydown", keyboardHandler, {
                capture: true,
              });
            },

            onUpdate: (props) => {
              if (!props.clientRect || !component) {
                return;
              }

              if (nodeIdRef.current) {
                component.updateProps({
                  nodeId: nodeIdRef.current,
                  projectId: projectIdRef.current,
                  command: (item: any) => {
                    props.command(item);
                  },
                });
              } else {
                component.updateProps({
                  ...props,
                  items: buildLegacyMentionListItems(
                    props.items as Array<Record<string, unknown>>,
                  ),
                });
              }
              updateSuggestionPosition(props.editor, component.element);
            },

            onExit: () => {
              if (keyboardHandler && editorDom) {
                editorDom.removeEventListener("keydown", keyboardHandler, {
                  capture: true,
                });
                keyboardHandler = null;
                editorDom = null;
              }

              component?.destroy();
              component = null;
            },
          };
        },
      },
    });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        dropcursor: {
          class: "ProseMirror-dropcursor",
          color: "#B43FEB",
          width: 2,
        },
      }),
      mentionExtension,
    ],
    content: promptDraftHtml,
    editorProps: {
      attributes: {
        class: cn(
          PROMPT_PANEL_STYLES.editorContent,
          "leading-6",
          "focus:outline-none",
        ),
        spellcheck: "false",
      },
      handleKeyDown: (_view, event) => {
        if (event.code === "Space" || event.key === " ") {
          event.stopPropagation();
        }

        return false;
      },
      handleDOMEvents: {
        pointerdown: (_view, event) => {
          if (event.shiftKey && event.button === 0) {
            event.stopPropagation();
          }
          return false;
        },
        mousedown: (_view, event) => {
          if (event.shiftKey && event.button === 0) {
            event.stopPropagation();
          }
          return false;
        },
        click: (_view, event) => {
          if (event.shiftKey && event.button === 0) {
            event.stopPropagation();
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onDraftChange({
        text: currentEditor.getText(),
        html: currentEditor.getHTML(),
      });
    },
  });

  useEffect(() => {
    // TipTap 的只读状态会阻止键盘、粘贴和拖放等所有正文编辑入口。
    editor?.setEditable(isEditable);
  }, [editor, isEditable]);

  useImperativeHandle(
    ref,
    () => ({
      getPlainText: () => editor?.getText({ blockSeparator: "\n" }) ?? "",
      getDocumentJSON: () => editor?.getJSON() ?? null,
      insertContent: (content: string) => {
        if (!editor) return;
        const { from } = editor.state.selection;
        editor.commands.insertContentAt(from, content);
      },
      removeReferenceMentions: (matchers) => {
        if (!editor || !matchers.length) {
          return 0;
        }

        const rangesToDelete: Array<{ from: number; to: number }> = [];

        const normalizedMatchers = matchers.map((matcher) => ({
          ids: new Set(matcher.ids ?? []),
          thumbnail: matcher.thumbnail,
          type: matcher.type,
        }));

        normalizedMatchers.forEach((matcher) => {
          const idMatches: Array<{ from: number; to: number }> = [];
          const fallbackMatches: Array<{ from: number; to: number }> = [];

          editor.state.doc.descendants((node, pos) => {
            if (node.type.name !== "mention") {
              return true;
            }

            const mentionId = String(node.attrs.id ?? "");
            const mentionThumbnail = String(node.attrs.thumbnail ?? "");
            const mentionType = node.attrs.type as
              | "image"
              | "video"
              | "audio"
              | undefined;

            const typeMatched = !matcher.type || matcher.type === mentionType;

            if (matcher.ids.size > 0 && matcher.ids.has(mentionId)) {
              idMatches.push({ from: pos, to: pos + node.nodeSize });
              return true;
            }

            if (
              matcher.thumbnail &&
              typeMatched &&
              matcher.thumbnail === mentionThumbnail
            ) {
              fallbackMatches.push({ from: pos, to: pos + node.nodeSize });
            }

            return true;
          });

          rangesToDelete.push(
            ...(idMatches.length > 0 ? idMatches : fallbackMatches),
          );
        });

        const uniqueRanges = Array.from(
          new Map(
            rangesToDelete.map((range) => [`${range.from}-${range.to}`, range]),
          ).values(),
        ).sort((a, b) => b.from - a.from);

        if (uniqueRanges.length === 0) {
          return 0;
        }

        let transaction = editor.state.tr;
        uniqueRanges.forEach((range) => {
          transaction = transaction.delete(range.from, range.to);
        });
        editor.view.dispatch(transaction);

        return uniqueRanges.length;
      },
      updateReferenceMentions: (updates) => {
        if (!editor || updates.length === 0) {
          return 0;
        }

        const updateMap = new Map(updates.map((item) => [item.id, item]));
        let transaction = editor.state.tr;
        let updatedCount = 0;

        editor.state.doc.descendants((node, pos) => {
          if (node.type.name !== "mention") {
            return true;
          }

          const mentionId = String(node.attrs.id ?? "");
          const update = updateMap.get(mentionId);
          if (!update) {
            return true;
          }

          transaction = transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            // update.label 已是 displayLabel（中文数字），写入 attrs.label 与 value。
            label: update.label,
            displayLabel: update.label,
            originalLabel:
              update.originalLabel ?? node.attrs.originalLabel ?? update.label,
            value: update.value ?? update.label,
            thumbnail: update.thumbnail ?? node.attrs.thumbnail,
            url: update.url ?? node.attrs.url,
            fileUrl: update.fileUrl ?? node.attrs.fileUrl,
            source: update.source ?? node.attrs.source,
            scope: update.scope ?? node.attrs.scope,
            assetId: update.assetId ?? node.attrs.assetId,
            nodeId: update.nodeId ?? node.attrs.nodeId,
            primaryCategory:
              update.primaryCategory ?? node.attrs.primaryCategory,
            category:
              update.category ??
              node.attrs.category ??
              update.primaryCategory ??
              node.attrs.primaryCategory,
            type: update.type ?? node.attrs.type,
            mediaType: update.mediaType ?? update.type ?? node.attrs.mediaType,
          });
          updatedCount += 1;
          return true;
        });

        if (updatedCount > 0) {
          editor.view.dispatch(transaction);
        }

        return updatedCount;
      },
      /**
       * 把“优化后的纯文本”回填到编辑器，同时保留原 doc 中的 mention 节点 attrs。
       *
       * 思路：
       * 1) 解析原 doc，记录所有 mention 节点（按出现顺序）的 attrs；
       * 2) 解析优化后文本，按 `ImageN / AudioN / VideoN` 占位符顺序与原 mention 对位；
       *    找不到占位符的 mention 节点会排在文本末尾。
       * 3) 在编辑器中按段重建新 doc：
       *    - 段落内把 mention id 列表与占位符位置拼回 paragraph children；
       *    - 同一段落额外填入占位符之间的普通文本。
       *
       * 这样视觉上仍看到 @ 资产 pill，且归一化系统（基于 doc attrs）能继续读到
       * `image_urls / video_urls / audio_urls` 与上方参考列表一起参与合并。
       */
      replaceTextPreservingMentions: (nextText: string) => {
        if (!editor) return;

        const sourceDoc = editor.state.doc;
        const mentionQueue: Array<Record<string, unknown>> = [];
        sourceDoc.descendants((node) => {
          if (node.type.name === "mention") {
            mentionQueue.push({ ...node.attrs });
          }
          return true;
        });

        // 提取优化后文本中的 `ImageN / AudioN / VideoN` 占位符位置。
        const PLACEHOLDER_REGEX = /(Image|Audio|Video)\s*(\d+)/g;
        const segments: Array<
          | { kind: "text"; text: string }
          | { kind: "mention"; kindType: "image" | "audio" | "video"; index: number }
        > = [];
        let lastIndex = 0;
        let cursor = 0;
        for (const match of nextText.matchAll(PLACEHOLDER_REGEX)) {
          const matched = match[0];
          const start = match.index ?? 0;
          if (start > lastIndex) {
            segments.push({
              kind: "text",
              text: nextText.slice(lastIndex, start),
            });
          }
          segments.push({
            kind: "mention",
            kindType: match[1].toLowerCase() as
              | "image"
              | "audio"
              | "video",
            index: Number.parseInt(match[2], 10),
          });
          lastIndex = start + matched.length;
          cursor += 1;
        }
        if (lastIndex < nextText.length) {
          segments.push({ kind: "text", text: nextText.slice(lastIndex) });
        }

        // 计算每种类型 mention 在原 doc 中的出现顺序（保持归一化规则：type 独立编号）。
        const orderedByType: Record<
          "image" | "audio" | "video",
          Array<Record<string, unknown>>
        > = {
          image: [],
          audio: [],
          video: [],
        };
        mentionQueue.forEach((attrs) => {
          const kindRaw = (attrs.type as string | null) ??
            (attrs.mediaType as string | null) ??
            "";
          if (kindRaw === "image" || kindRaw === "audio" || kindRaw === "video") {
            orderedByType[kindRaw].push(attrs);
          }
        });

        const mentionSchema = editor.schema.nodes.mention;
        type ProseNode = {
          type: string;
          content?: ProseNode[];
          attrs?: Record<string, unknown>;
          text?: string;
        };
        const nodes: ProseNode[] = [];

        const appendText = (text: string) => {
          text.split(/\r?\n/).forEach((paragraph, index) => {
            if (paragraph.length === 0) return;

            const last = nodes[nodes.length - 1];
            if (index === 0 && last?.type === "paragraph") {
              last.content = [
                ...(last.content ?? []),
                { type: "text", text: paragraph },
              ];
              return;
            }

            nodes.push({
              type: "paragraph",
              content: [{ type: "text", text: paragraph }],
            });
          });
        };

        segments.forEach((segment) => {
          if (segment.kind === "text") {
            // 无换行的文本与相邻 mention 保持在同一段落；显式换行才创建新段落。
            appendText(segment.text);
            return;
          }
          const sameKind = orderedByType[segment.kindType];
          const target = sameKind[Math.max(segment.index - 1, 0)];
          const appendMention = (attrs: Record<string, unknown>) => {
            const last = nodes[nodes.length - 1];
            if (!last || last.type !== "paragraph") {
              nodes.push({
                type: "paragraph",
                content: [{ type: "mention", attrs }],
              });
            } else {
              last.content = [
                ...(last.content ?? []),
                { type: "mention", attrs },
              ];
            }
          };
          if (!target) {
            // 找不到对位 mention → 当成普通文本占位符写入。
            nodes.push({
              type: "paragraph",
              content: [
                { type: "text", text: `Image${segment.index}` },
              ],
            });
            return;
          }
          appendMention(target);
        });

        // 把所有未能对位的旧 mention 追加到正文末尾，确保不缺资产。
        const usedMentionIds = new Set(
          orderedByType.image
            .concat(orderedByType.audio)
            .concat(orderedByType.video)
            .map((m) => m.id as string),
        );
        mentionQueue.forEach((attrs) => {
          if (usedMentionIds.has(attrs.id as string)) {
            return;
          }
          const last = nodes[nodes.length - 1];
          if (!last || last.type !== "paragraph") {
            nodes.push({
              type: "paragraph",
              content: [{ type: "mention", attrs }],
            });
          } else {
            last.content = [
              ...(last.content ?? []),
              { type: "mention", attrs },
            ];
          }
        });

        const finalContent = nodes.length > 0
          ? nodes
          : [{ type: "paragraph" }];

        // 给每个 mention 节点补 schema 必需的 attrs，避免老 Schema 报错。
        const sanitized = JSON.parse(JSON.stringify(finalContent));
        const walk = (entry: unknown) => {
          if (!entry || typeof entry !== "object") return;
          const record = entry as Record<string, unknown>;
          if (record.type === "mention") {
            const attrs = (record.attrs ?? {}) as Record<string, unknown>;
            attrs.id ??= "";
            attrs.label ??= attrs.displayLabel ?? "";
            attrs.type ??= "image";
          }
          if (Array.isArray(record.content)) {
            record.content.forEach(walk);
          }
        };
        sanitized.forEach(walk);

        // 通过 schema 直接设置内容。mention 可能因 schema 不允许属性而抛错，
        // 失败时回退成纯文本，保持编辑体验可用。
        try {
          editor.commands.setContent(sanitized, { emitUpdate: true });
        } catch (error) {
          console.warn(
            "[VideoPromptEditor] mention schema 写入失败，改为纯文本回填：",
            error,
          );
          editor.commands.setContent(
            `<p>${escapeHtmlFallback(nextText)}</p>`,
            { emitUpdate: true },
          );
          void mentionSchema; // 保留 schema 引用以避免 lint 警告。
        }
      },
    }),
    [editor],
  );

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

  useEffect(() => {
    if (!editor) {
      return;
    }

    const editorDom = editor.view.dom;

    const getMediaMentionPill = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null;
      }

      const mentionPill = target.closest(".video-node-mention-pill");
      if (!(mentionPill instanceof HTMLElement)) {
        return null;
      }

      const mentionType =
        mentionPill.dataset.mentionKind || mentionPill.dataset.mediaType;
      const thumbnail =
        mentionPill.dataset.thumbnail ||
        mentionPill.querySelector<HTMLImageElement>(
          ".video-node-mention-pill__thumbnail",
        )?.src;

      if (mentionType === "video") {
        const videoUrl = mentionPill.dataset.url || mentionPill.dataset.fileUrl;
        if (!videoUrl && !thumbnail) {
          return null;
        }
        return { element: mentionPill, type: "video" as const, thumbnail, videoUrl };
      }

      if (mentionType !== "image" || !thumbnail) {
        return null;
      }

      return { element: mentionPill, type: "image" as const, thumbnail };
    };

    const handleMouseOver = (event: MouseEvent) => {
      const result = getMediaMentionPill(event.target);
      if (!result) {
        return;
      }

      if (
        event.relatedTarget instanceof Node &&
        result.element.contains(event.relatedTarget)
      ) {
        return;
      }

      const rect = result.element.getBoundingClientRect();
      setPreview({
        src: result.type === "video" && result.videoUrl
          ? result.videoUrl
          : result.thumbnail || "",
        label:
          result.element.dataset.mentionOriginalLabel ||
          (result.type === "video" ? "提及视频" : "提及图片"),
        left: rect.left + rect.width / 2,
        top: Math.max(12, rect.top - 8),
        type: result.type,
      });
    };

    const handleMouseOut = (event: MouseEvent) => {
      const result = getMediaMentionPill(event.target);
      if (!result) {
        return;
      }

      if (
        event.relatedTarget instanceof Node &&
        result.element.contains(event.relatedTarget)
      ) {
        return;
      }

      setPreview(null);
    };

    const handleDragStart = (event: DragEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const mentionPill = target.closest(".video-node-mention-pill");
      if (mentionPill) {
        mentionPill.classList.add("dragging");
        event.dataTransfer?.setData(
          "text/plain",
          mentionPill.getAttribute("data-mention-id") || "",
        );
      }
    };

    const handleDragEnd = (event: DragEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const mentionPill = target.closest(".video-node-mention-pill");
      if (mentionPill) {
        mentionPill.classList.remove("dragging");
      }

      editorDom
        .querySelectorAll(".video-node-mention-pill.dragging")
        .forEach((element) => {
          element.classList.remove("dragging");
        });
    };

    editorDom.addEventListener("dragstart", handleDragStart);
    editorDom.addEventListener("dragend", handleDragEnd);
    editorDom.addEventListener("mouseover", handleMouseOver);
    editorDom.addEventListener("mouseout", handleMouseOut);

    return () => {
      editorDom.removeEventListener("dragstart", handleDragStart);
      editorDom.removeEventListener("dragend", handleDragEnd);
      editorDom.removeEventListener("mouseover", handleMouseOver);
      editorDom.removeEventListener("mouseout", handleMouseOut);
    };
  }, [editor]);

  return (
    <>
      <EditorContent editor={editor} />
      {preview &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{
              left: preview.left,
              top: preview.top,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="flex w-60 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl transition-opacity duration-150">
              {preview.type === "video" ? (
                <video
                  src={preview.src}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="h-auto w-full object-contain"
                />
              ) : (
                <img
                  src={preview.src}
                  alt={preview.label}
                  className="h-auto w-full rounded-xl object-contain"
                />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
});

VideoPromptEditor.displayName = "VideoPromptEditor";
