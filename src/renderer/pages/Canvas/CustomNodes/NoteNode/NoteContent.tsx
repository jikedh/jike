import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type NoteContentProps = {
  content: string;
  isEditing: boolean;
  isSelected: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onContentBlur: (value: string) => void;
};

export const NoteContent = ({
  content,
  isEditing,
  isSelected,
  onStartEdit,
  onStopEdit,
  onContentBlur,
}: NoteContentProps) => {
  if (isEditing) {
    return (
      <textarea
        defaultValue={content}
        maxLength={2500}
        onDoubleClick={(e) => e.stopPropagation()}
        onWheelCapture={(e) => {
          if (!e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
          }
        }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
          }
        }}
        className="note-scrollbar noflow nopan nodrag h-full w-full resize-none rounded-b-xl border-0 bg-[#1f1f1f] p-3 text-sm text-white outline-none ring-0 placeholder:text-white/70"
        onBlur={(event) => {
          onContentBlur(event.target.value);
          onStopEdit();
        }}
        autoFocus
      />
    );
  }

  return (
    <div
      className={`note-scrollbar noflow nopan h-full w-full rounded-b-xl bg-[#1f1f1f] p-3 text-sm text-white/90 cursor-text overflow-hidden`}
      onClick={(e) => {
        // 当按下 Ctrl/Meta 键时，不触发编辑模式，让事件传播
        if (e.ctrlKey || e.metaKey) {
          return;
        }
        e.stopPropagation();
        onStartEdit();
      }}
      onDoubleClick={(e) => {
        // 当按下 Ctrl/Meta 键时，不触发编辑模式，让事件传播
        if (e.ctrlKey || e.metaKey) {
          return;
        }
        e.stopPropagation();
        onStartEdit();
      }}
    >
      {content ? (
        <div className=" prose prose-invert prose-sm max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_p]:my-1 [&_p]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white [&_strong]:font-bold [&_code]:text-[#B43FEB] [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-[#B43FEB] [&_blockquote]:pl-3 [&_blockquote]:text-white/70 [&_img]:outline-none [&_img]:border-0 [&_img]:resize-none [&_img]:focus:outline-none [&_img]:focus:ring-0">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      ) : (
        <div className="opacity-70 text-white">
          点击开始输入或编辑 Markdown...
        </div>
      )}
    </div>
  );
};
