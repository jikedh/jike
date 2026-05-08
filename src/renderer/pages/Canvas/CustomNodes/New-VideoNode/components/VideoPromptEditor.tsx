import Mention from "@tiptap/extension-mention";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  forwardRef,
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
import { MentionList } from "./MentionList";

export interface VideoPromptEditorHandle {
  getPlainText: () => string;
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
      value?: string;
      thumbnail?: string;
      type?: "image" | "video" | "audio";
    }>,
  ) => number;
}

export interface VideoPromptEditorProps {
  promptDraftHtml: string;
  mentionItems: {
    id: string;
    label: string;
    value: string;
    thumbnail: string;
    type: "image" | "video" | "audio";
  }[];
  onDraftChange: (payload: { text: string; html: string }) => void;
}

export const VideoPromptEditor = forwardRef<
  VideoPromptEditorHandle,
  VideoPromptEditorProps
>(({ promptDraftHtml, mentionItems, onDraftChange }, ref) => {
  const mentionItemsRef = useRef(mentionItems);

  useEffect(() => {
    mentionItemsRef.current = mentionItems;
  }, [mentionItems]);

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
        return getMentionLabel(node.attrs);
      },
      renderHTML({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs);
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
              alt: mentionLabel,
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
            "data-mention-kind": mentionType || "image",
            contenteditable: "false",
            draggable: "true",
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

              component = new ReactRenderer(MentionList, {
                props: {
                  ...props,
                  command: (item: any) => {
                    props.command(item);
                  },
                },
                editor: props.editor,
              });

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

              component.updateProps(props);
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
            label: update.label,
            value: update.value ?? update.label,
            thumbnail: update.thumbnail ?? node.attrs.thumbnail,
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
