import { IconTrash } from '@tabler/icons-react'

type NoteToolbarProps = {
    onDelete: () => void
}

// 文本节点工具栏：当前仅保留删除操作，保持交互尽量克制。
export const NoteToolbar = ({ onDelete }: NoteToolbarProps) => {
    return (
        <div className="noflow nopan nodrag absolute -top-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-background px-2 py-1 shadow-sm">
            <button
                type="button"
                title="删除节点"
                aria-label="删除节点"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                onClick={onDelete}
            >
                <IconTrash size={16} />
            </button>
        </div>
    )
}
