/**
 * Grok Video 视频参数面板组件
 * 包含画面比例、视频时长、分辨率等参数控制
 */

import { IconSettings, IconVideo } from '@tabler/icons-react'
import { useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { AspectRatioIcon } from '../../ImageNode/components/AspectRatioIcon'

type GrokVideoParamsPanelProps = {
    // 当前画面比例
    aspectRatio: string
    // 当前视频时长
    duration: number
    // 当前分辨率
    resolution?: string
    // 更新画面比例
    onAspectRatioChange: (value: string) => void
    // 更新视频时长
    onDurationChange: (value: number) => void
    // 更新分辨率
    onResolutionChange?: (value: string) => void
}

// Grok 视频时长预设选项：10s / 15s
const DURATION_PRESETS = [10, 15] as const

// Grok 视频分辨率选项
const RESOLUTION_OPTIONS = [
    { label: '1080P', value: '1080P', desc: '超清' },
    { label: '720P', value: '720P', desc: '高清' },
] as const

// Grok 视频宽高比选项
const GROK_ASPECT_RATIOS = [
    { label: '16:9', value: '16:9', desc: '横屏' },
    { label: '9:16', value: '9:16', desc: '竖屏' },
] as const

export const GrokVideoParamsPanel = ({
    aspectRatio,
    duration,
    resolution,
    onAspectRatioChange,
    onDurationChange,
    onResolutionChange,
}: GrokVideoParamsPanelProps) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    unstyled
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
                >
                    <IconSettings size={14} />
                    <span>整合参数</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="top"
                className="w-96 border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
            >
                <div className="space-y-5">
                    {/* 画面比例选择 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            画面比例
                        </label>
                        <div className="flex gap-2">
                            {GROK_ASPECT_RATIOS.map((item) => {
                                const isActive = aspectRatio === item.value
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => onAspectRatioChange(item.value)}
                                        className={cn(
                                            'flex flex-col items-center gap-0.5 rounded-lg border px-4 py-2 transition-all',
                                            isActive
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                        )}
                                    >
                                        <AspectRatioIcon
                                            ratio={item.value}
                                            size={28}
                                            active={isActive}
                                        />
                                        <span
                                            className={cn(
                                                'text-[10px]',
                                                isActive ? 'text-blue-400' : 'text-neutral-400',
                                            )}
                                        >
                                            {item.desc}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 视频时长选择 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            视频时长（秒）
                        </label>
                        <div className="flex gap-2">
                            {DURATION_PRESETS.map((preset) => {
                                const isActive = duration === preset
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => onDurationChange(preset)}
                                        className={cn(
                                            'flex flex-col items-center gap-0.5 rounded-lg border px-5 py-2.5 transition-all',
                                            isActive
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'text-sm font-medium',
                                                isActive ? 'text-blue-400' : 'text-neutral-300',
                                            )}
                                        >
                                            {preset}s
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-neutral-700" />

                    {/* 视频分辨率选择 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                            <IconVideo size={12} />
                            视频分辨率
                        </label>
                        <div className="flex gap-2">
                            {RESOLUTION_OPTIONS.map((item) => {
                                const isActive = resolution === item.value
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => onResolutionChange?.(item.value)}
                                        className={cn(
                                            'flex flex-col items-center gap-0.5 rounded-lg border px-4 py-2 transition-all',
                                            isActive
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'text-xs font-medium',
                                                isActive ? 'text-blue-400' : 'text-neutral-300',
                                            )}
                                        >
                                            {item.value}
                                        </span>
                                        <span
                                            className={cn(
                                                'text-[10px]',
                                                isActive ? 'text-blue-400/70' : 'text-neutral-500',
                                            )}
                                        >
                                            {item.desc}
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
