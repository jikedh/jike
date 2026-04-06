import { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface VideoMentionItem {
  id: string
  label: string
  value: string
  thumbnail: string
}

// Tiptap Suggestion API 的 props 类型
interface SuggestionProps {
  items: VideoMentionItem[]
  command: (item: { id: string; label: string; value: string; thumbnail?: string }) => void
}

interface VideoMentionListProps extends SuggestionProps {}

// 使用 forwardRef 以便父组件可以通过 ref 调用 onKeyDown
export const VideoMentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, VideoMentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const listRef = useRef<HTMLDivElement | null>(null)

    // 当 selectedIndex 改变时，自动滚动到选中的选项
    useEffect(() => {
      if (listRef.current) {
        const activeElement = listRef.current.children[selectedIndex] as HTMLElement
        if (activeElement) {
          activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }
    }, [selectedIndex])

    // 暴露 onKeyDown 方法给父组件
    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
          return true
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          selectItem(selectedIndex)
          return true
        }

        return false
      },
    }))

    // 当 items 变化时重置选中索引
    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    const selectItem = (index: number) => {
      const item = items[index]
      if (item && command) {
        command({ id: item.id, label: item.label, value: item.value, thumbnail: item.thumbnail })
      }
    }

    if (items.length === 0) {
      return null
    }

    return (
      <div ref={listRef} className="max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
        {items.map((item, index) => (
          <Button
            key={item.id}
            unstyled
            className={cn(
              'flex w-full items-center gap-3 border-b border-neutral-800 px-3 py-2 text-left last:border-b-0',
              index === selectedIndex ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-200 hover:bg-neutral-800',
            )}
            onMouseDown={(event) => {
              event.preventDefault()
              selectItem(index)
            }}
            onMouseEnter={() => {
              setSelectedIndex(index)
            }}
          >
            <img
              src={item.thumbnail}
              alt={item.label}
              className="h-7 w-7 shrink-0 rounded-md object-cover"
              loading="lazy"
            />
            <div className="text-xs font-medium">{item.label}</div>
          </Button>
        ))}
      </div>
    )
  }
)

VideoMentionList.displayName = 'VideoMentionList'
