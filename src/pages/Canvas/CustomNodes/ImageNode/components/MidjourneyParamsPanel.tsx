/**
 * Midjourney 整合参数面板组件
 * 包含图像尺寸的可视化选择
 * 适用于 midjourney 和 midjourney-niji7 模型
 */

import { IconSettings } from '@tabler/icons-react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { AspectRatioIcon } from './AspectRatioIcon'

// Midjourney 图像尺寸选项（参考官方常用尺寸）
export const MIDJOURNEY_ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', description: '正方形' },
  { label: '16:9', value: '16:9', description: '横向宽屏' },
  { label: '9:16', value: '9:16', description: '竖向长图' },
  { label: '3:4', value: '3:4', description: '竖向3:4' },
  { label: '4:3', value: '4:3', description: '横向4:3' },
  { label: '3:2', value: '3:2', description: '横向3:2' },
  { label: '2:3', value: '2:3', description: '竖向2:3' },
  { label: '21:9', value: '21:9', description: '超宽屏' },
]

type MidjourneyParamsPanelProps = {
  // 当前图像尺寸
  size: string
  // 更新图像尺寸
  onSizeChange: (value: string) => void
}

export const MidjourneyParamsPanel = ({
  size,
  onSizeChange,
}: MidjourneyParamsPanelProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <AspectRatioIcon ratio={size} size={16} />
          <span>{size}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
      >
        <div className="space-y-2">
          {/* 标题 */}
          <label className="text-xs font-medium text-neutral-300">
            图像尺寸
          </label>
          {/* 尺寸选择网格 */}
          <div className="grid grid-cols-4 gap-2">
            {MIDJOURNEY_ASPECT_RATIOS.map((item) => {
              const isActive = size === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onSizeChange(item.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all',
                    isActive
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                  )}
                >
                  <AspectRatioIcon
                    ratio={item.value}
                    size={24}
                    active={isActive}
                  />
                  <span
                    className={cn(
                      'text-[10px]',
                      isActive ? 'text-blue-400' : 'text-neutral-400',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
