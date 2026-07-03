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
} from "react";

import {
  cn,
  getMentionLabel,
  updateSuggestionPosition,
} from "shared/utils/utils";
import { PROMPT_PANEL_STYLES } from "../../shared/promptPanelStyles";
import { handlePromptEditorWheelCapture } from "../../shared/wheelEvents";
import { AssetMentionMenu } from "../../shared/AssetMentionMenu";
import type { MentionAssetOption } from "../../shared/assetMentionTypes";
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
      type?: "image" | "video" | "audio";
    }>,
  ) => number;
}

export interface VideoPromptEditorProps {
  promptDraftHtml: string;
  nodeId?: string;
  projectId?: string | null;
  mentionItems: {
    id: string;
    label: string;
    originalLabel?: string;
    value: string;
    thumbnail: string;
    type: "image" | "video" | "audio";
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
  source: option.source,
  scope: option.scope,
  assetId: option.assetId,
  nodeId: option.nodeId,
  primaryCategory: option.primaryCategory,
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
      autoFocus
      onQueryChange={menu.setQuery}
      onSelect={selectOption}
      onHoverOption={menu.setSelectedByKey}
      onInputKeyDown={handleInputKeyDown}
    />
  );
});

AssetMentionSuggestion.displayName = "AssetMentionSuggestion";

export const VideoPromptEditor = forwardRef<
  VideoPromptEditorHandle,
  VideoPromptEditorProps
>(({ promptDraftHtml, nodeId, projectId, mentionItems, onDraftChange }, ref) => {
  const mentionItemsRef = useRef(mentionItems);
  const nodeIdRef = useRef(nodeId);
  const projectIdRef = useRef(projectId);

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
            "data-type": "mention",
            "data-mention-id": node.attrs.id,
            "data-mention-value": node.attrs.value,
            "data-mention-label": mentionLabel,
            "data-mention-display-label": mentionLabel,
            "data-mention-original-label": originalLabel,
            "data-mention-kind": mentionType || "image",
            "data-mention-source": node.attrs.source,
            "data-mention-scope": node.attrs.scope,
            "data-asset-id": node.attrs.assetId,
            "data-node-id": node.attrs.nodeId,
            "data-primary-category": node.attrs.primaryCategory,
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

  useImperativeHandle(
    ref,
    () => ({
      getPlainText: () => editor?.getText().trim() ?? "",
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
            type: update.type ?? node.attrs.type,
          });
          updatedCount += 1;
          return true;
        });

        if (updatedCount > 0) {
          editor.view.dispatch(transaction);
        }

        return updatedCount;
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

    return () => {
      editorDom.removeEventListener("dragstart", handleDragStart);
      editorDom.removeEventListener("dragend", handleDragEnd);
    };
  }, [editor]);

  return (
    <EditorContent
      editor={editor}
      onWheelCapture={handlePromptEditorWheelCapture}
    />
  );
});

VideoPromptEditor.displayName = "VideoPromptEditor";
