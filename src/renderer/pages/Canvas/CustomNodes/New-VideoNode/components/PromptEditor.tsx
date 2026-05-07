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
import type { MentionItem } from "../constants/mockData";
import { MentionList } from "./MentionList";

export interface PromptEditorHandle {
  getPlainText: () => string;
}

export interface PromptEditorProps {
  mentionItems: MentionItem[];
  onChange: (text: string) => void;
}

export const PromptEditor = forwardRef<PromptEditorHandle, PromptEditorProps>(
  ({ mentionItems, onChange }, ref) => {
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
                    command: (item: {
                      id: string;
                      label: string;
                      value: string;
                      thumbnail?: string;
                      type?: "image" | "video" | "audio";
                    }) => {
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
                      onKeyDown?: (payload: {
                        event: KeyboardEvent;
                      }) => boolean;
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
      content: "",
      editorProps: {
        attributes: {
          class: cn(
            PROMPT_PANEL_STYLES.editorContent,
            "leading-6",
            "focus:outline-none",
          ),
          spellcheck: "false",
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        onChange(currentEditor.getText());
      },
    });

    useImperativeHandle(ref, () => ({
      getPlainText: () => editor?.getText().trim() ?? "",
    }));

    return (
      <EditorContent
        editor={editor}
        className="min-h-20 max-h-40 overflow-y-auto"
        onWheelCapture={handlePromptEditorWheelCapture}
      />
    );
  },
);

PromptEditor.displayName = "PromptEditor";
