import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type NoteContentProps = {
  content: string
  isEditing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onContentBlur: (value: string) => void
}

export const NoteContent = ({
  content,
  isEditing,
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
        className="note-scrollbar noflow nopan h-full w-full resize-none rounded-md border-0 bg-[#1f1f1f] p-2 text-sm text-white outline-none ring-0 placeholder:text-white/70 nodrag"
        onBlur={(event) => {
          onContentBlur(event.target.value)
          onStopEdit()
        }}
      />
    )
  }

  return (
    <div
      className="note-scrollbar noflow nopan h-full w-full overflow-auto rounded-md bg-[#1f1f1f] p-3 text-sm text-white/90"
      onDoubleClick={(e) => {
        e.stopPropagation()
        onStartEdit()
      }}
    >
      {content ? (
        <div className="prose prose-invert prose-sm max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_p]:my-1 [&_p]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white [&_strong]:font-bold [&_code]:text-[#B43FEB] [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-[#B43FEB] [&_blockquote]:pl-3 [&_blockquote]:text-white/70">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      ) : (
        <div className="opacity-70 text-white">双击开始输入或编辑 Markdown...</div>
      )}
    </div>
  )
}
