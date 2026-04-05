/**
 * Gemini 3 Pro 整合参数面板组件
 * 包含图像尺寸、分辨率的可视化选择
 * 适用于 gemini-3-pro-image-preview 模型
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

// Gemini 3 Pro 图像尺寸选项（与类型定义保持一致）
export const GEMINI_SIZES = [
  { label: '1:1', value: '1:1', description: '正方形' },
  { label: '2:3', value: '2:3', description: '竖向2:3' },
  { label: '3:2', value: '3:2', description: '横向3:2' },
  { label: '3:4', value: '3:4', description: '竖向3:4' },
  { label: '4:3', value: '4:3', description: '横向4:3' },
  { label: '4:5', value: '4:5', description: '竖向4:5' },
  { label: '5:4', value: '5:4', description: '横向5:4' },
  { label: '9:16', value: '9:16', description: '竖向长图' },
  { label: '16:9', value: '16:9', description: '横向宽屏' },
  { label: '21:9', value: '21:9', description: '超宽屏' },
]

// Gemini 3 Pro 分辨率选项
export const GEMINI_RESOLUTIONS = [
  { label: '1K', value: '1K', description: '默认分辨率' },
  { label: '2K', value: '2K', description: '标准分辨率' },
  { label: '4K', value: '4K', description: '高清分辨率' },
]

type GeminiParamsPanelProps = {
  // 当前图像尺寸
  size: string
  // 当前分辨率
  resolution: string
  // 更新图像尺寸
  onSizeChange: (value: string) => void
  // 更新分辨率
  onResolutionChange: (value: string) => void
}

export const GeminiParamsPanel = ({
  size,
  resolution,
  onSizeChange,
  onResolutionChange,
}: GeminiParamsPanelProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          unstyled
          className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
        >
          <AspectRatioIcon ratio={size} size={16} />
          <span>{size} | {resolution}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-96 border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
      >
        <div className="space-y-4">
          {/* 图像尺寸选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              图像尺寸
            </label>
            <div className="grid grid-cols-5 gap-2">
              {GEMINI_SIZES.map((item) => {
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

          {/* 分辨率选择 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              分辨率
            </label>
            <div className="flex gap-2">
              {GEMINI_RESOLUTIONS.map((item) => {
                const isActive = resolution === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onResolutionChange(item.value)}
                    className={cn(
                      'flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all',
                      isActive
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isActive ? 'text-blue-400' : 'text-neutral-300',
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {item.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
