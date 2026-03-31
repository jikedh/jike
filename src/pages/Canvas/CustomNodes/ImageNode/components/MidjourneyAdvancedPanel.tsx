import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { IconEyeSpark, IconGripVertical } from '@tabler/icons-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MidjourneyAdvancedPanelProps = {
  referenceImageUrls?: string[]
  value?: {
    referenceUrls?: string[]
    styleUrls?: string[]
    iw?: number
    sw?: number
  }
  onChange?: (next: {
    referenceUrls?: string[]
    styleUrls?: string[]
    iw?: number
    sw?: number
  }) => void
}

// 可拖拽图片项组件
const DraggableImageItem = ({
  url,
  dragId,
}: {
  url: string
    dragId: string
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { url },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800',
        isDragging && 'opacity-50'
      )}
    >
      <img
        src={url}
        alt="图片"
        className="h-full w-full object-cover"
        loading="lazy"
        draggable={false}
      />
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 flex cursor-grab items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <IconGripVertical size={16} className="text-white" />
      </div>
    </div>
  )
}

// 可放置区域容器
const DroppableImageList = ({
  id,
  images,
  emptyText,
  isDragging,
}: {
  id: string
  images: string[]
    emptyText: string
    isDragging: boolean
}) => {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ scrollbarGutter: 'stable both-edges' }}
      className={cn(
        'flex gap-2 rounded-lg border bg-neutral-800/50 p-2 pb-1 transition-colors',
        isDragging ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden',
        isOver ? 'border-blue-500 bg-neutral-800/80' : 'border-neutral-700'
      )}
    >
      {images.length > 0 ? (
        images.map((url, index) => (
          <DraggableImageItem key={`${id}-${index}-${url}`} url={url} dragId={`${id}-${index}-${url}`} />
        ))
      ) : (
        <div className="flex h-14 flex-1 items-center justify-center text-xs text-neutral-500">
          {emptyText}
        </div>
      )}
    </div>
  )
}

/**
 * Midjourney 高级选项面板
 * 使用 Popover 触发方式，与"整合参数"交互一致
 * 当用户点击"高级选项"按钮时展开面板
 * 包含两个可拖拽的图片列表，支持将图片从一个列表拖到另一个列表
 */
export const MidjourneyAdvancedPanel = ({
  referenceImageUrls = [],
  value,
  onChange,
}: MidjourneyAdvancedPanelProps) => {
  const topImages = value?.referenceUrls ?? []
  const bottomImages = value?.styleUrls ?? []
  // 当前正在拖拽的图片
  const [activeId, setActiveId] = useState<string | null>(null)
  const isDragging = Boolean(activeId)
  const topSliderValue = value?.iw ?? 0.5
  const bottomSliderValue = value?.sw ?? 100

  useEffect(() => {
    const currentReferenceUrls = value?.referenceUrls ?? []
    const currentStyleUrls = value?.styleUrls ?? []
    const hasNewReference = referenceImageUrls.some(
      (url) => !currentReferenceUrls.includes(url) && !currentStyleUrls.includes(url)
    )

    if (!hasNewReference) {
      return
    }

    onChange?.({
      ...value,
      referenceUrls: Array.from(
        new Set([
          ...currentReferenceUrls,
          ...referenceImageUrls.filter((url) => !currentStyleUrls.includes(url)),
        ])
      ),
    })
  }, [referenceImageUrls, onChange, value])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // 处理拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeData = active.data.current as { url: string }
    const overId = over.id as string

    const url = activeData.url
    if (!url) return

    // 确定目标容器
    const isToBottom = overId === 'bottom-list'
    const isToTop = overId === 'top-list'

    if (isToBottom) {
      // 拖到下方列表
      onChange?.({
        ...value,
        referenceUrls: topImages.filter((u) => u !== url),
        styleUrls: bottomImages.includes(url) ? bottomImages : [...bottomImages, url],
      })
    } else if (isToTop) {
      // 拖到上方列表
      onChange?.({
        ...value,
        styleUrls: bottomImages.filter((u) => u !== url),
        referenceUrls: topImages.includes(url) ? topImages : [...topImages, url],
      })
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <IconEyeSpark size={14} />
          <span>高级选项</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-100 border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          autoScroll={false}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="space-y-3">
            {/* 上方图片列表 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">
                参考图列表
              </label>
              <DroppableImageList
                id="top-list"
                images={topImages}
                emptyText="暂无参考图"
                isDragging={isDragging}
              />
              {/* 上方列表滑块 */}
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        value={topSliderValue}
                        onChange={(event) => {
                          const next = Number(event.target.value)
                          if (!Number.isNaN(next)) {
                            onChange?.({
                              ...value,
                              iw: next,
                            })
                          }
                        }}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-neutral-800 text-neutral-200 border-neutral-700">
                      <p>参考图权重</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs text-neutral-400 w-8 text-right">{topSliderValue.toFixed(1)}</span>
              </div>
            </div>


            {/* 下方图片列表 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">风格</label>
              <DroppableImageList
                id="bottom-list"
                images={bottomImages}
                emptyText="暂无风格"
                isDragging={isDragging}
              />
              {/* 下方列表滑块 */}
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <input
                        type="range"
                        min={100}
                        max={1000}
                        step={50}
                        value={bottomSliderValue}
                        onChange={(event) => {
                          const next = Number(event.target.value)
                          if (!Number.isNaN(next)) {
                            onChange?.({
                              ...value,
                              sw: next,
                            })
                          }
                        }}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-neutral-800 text-neutral-200 border-neutral-700">
                      <p>风格权重</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs text-neutral-400 w-10 text-right">{bottomSliderValue}</span>
              </div>
            </div>
          </div>
        </DndContext>
      </PopoverContent>
    </Popover>
  )
}
