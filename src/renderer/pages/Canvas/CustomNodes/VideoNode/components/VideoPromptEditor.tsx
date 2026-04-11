import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { cn, getMentionLabel, updateSuggestionPosition } from "shared/lib/utils";
import { VideoMentionList } from "../VideoMentionList";

/**
 * 编辑器对外暴露的方法集合。
 * 目前仅提供读取纯文本能力，供容器在点击“生成”时合并提示词。
 */
export interface VideoPromptEditorHandle {
  getPlainText: () => string;
}

/**
 * 编辑器组件属性。
 */
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

/**
 * 视频提示词富文本编辑器。
 * 将 TipTap 配置、@ 提及渲染与拖拽行为收敛到独立组件，降低容器复杂度。
 */
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
      /**
       * 兼容历史数据：早期实现将 data-type 用作资源类型（image/video/audio），
       * 会导致 Mention 节点在 setContent 时无法被 Tiptap 正常识别。
       * 这里改为按 data-mention-id 兜底解析，确保旧草稿也能恢复为 mention 节点。
       */
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
              // 新协议：data-mention-kind；兼容旧协议：data-type=image/video/audio
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
            // 保持 Tiptap Mention 的标准约定，避免再次被覆盖
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

              component = new ReactRenderer(VideoMentionList, {
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
          "nodrag nopan nowheel min-h-[88px] max-h-[220px] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900/85 px-3 py-2 text-sm leading-6 text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] cursor-text",
          "focus:outline-none",
        ),
      },
      handleKeyDown: (_view, event) => {
        // 当焦点在视频提示词输入区时，空格仅用于输入，不向画布层冒泡。
        if (event.code === "Space" || event.key === " ") {
          event.stopPropagation();
        }

        // 返回 false 让编辑器继续执行默认输入行为（插入空格字符）。
        return false;
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

  return <EditorContent editor={editor} />;
});

VideoPromptEditor.displayName = "VideoPromptEditor";
