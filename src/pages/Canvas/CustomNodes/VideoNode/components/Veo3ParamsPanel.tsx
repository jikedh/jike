/**
 * Veo 3 视频参数面板组件
 * 包含画面比例、视频时长、分辨率、音频生成、负面提示词、人物安全等参数控制
 */

import { IconChevronDown, IconVolume3, IconBan, IconImageInPicture } from '@tabler/icons-react'
import { useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { AspectRatioIcon } from '../../ImageNode/components/AspectRatioIcon'

type Veo3ParamsPanelProps = {
    // 当前画面比例
    aspectRatio: string
    // 当前视频时长
    duration: number
    // 当前分辨率
    resolution?: string
    // Veo3 专属参数
    generateAudio?: boolean
    negativePrompt?: string
    personGeneration?: string
    referenceImages?: string[]
    compressionQuality?: string
    resizeMode?: string
    // 更新画面比例
    onAspectRatioChange: (value: string) => void
    // 更新视频时长
    onDurationChange: (value: number) => void
    // 更新分辨率
    onResolutionChange?: (value: string) => void
    // 更新音频开关
    onGenerateAudioChange?: (value: boolean) => void
    // 更新负面提示词
    onNegativePromptChange?: (value: string) => void
    // 更新人物安全设置
    onPersonGenerationChange?: (value: string) => void
    // 更新素材参考图
    onReferenceImagesChange?: (value: string[]) => void
    // 更新压缩质量
    onCompressionQualityChange?: (value: string) => void
    // 更新图片调整模式
    onResizeModeChange?: (value: string) => void
}

// Veo3 视频时长预设选项：4s / 6s / 8s
const DURATION_PRESETS = [4, 6, 8] as const

// Veo3 视频分辨率选项
const RESOLUTION_OPTIONS = [
    { label: '1080P', value: '1080p', desc: '超清' },
    { label: '720P', value: '720p', desc: '高清' },
] as const

// Veo3 视频宽高比选项
const VEO3_ASPECT_RATIOS = [
    { label: '16:9', value: '16:9', desc: '横屏' },
    { label: '9:16', value: '9:16', desc: '竖屏' },
] as const

// 人物生成安全设置选项
const PERSON_GENERATION_OPTIONS = [
    { label: '允许成年人', value: 'allow_adult', desc: '可以生成成年人图像' },
    { label: '不允许生成人物', value: 'dont_allow', desc: '不会生成人物图像' },
] as const

// 压缩质量选项
const COMPRESSION_QUALITY_OPTIONS = [
    { label: '优化压缩', value: 'optimized', desc: '默认压缩方式' },
    { label: '无损压缩', value: 'lossless', desc: '保持原始质量' },
] as const

// 图片调整模式选项
const RESIZE_MODE_OPTIONS = [
    { label: '填充模式', value: 'pad', desc: '保持原始比例' },
    { label: '裁剪模式', value: 'crop', desc: '填满画面' },
] as const

export const Veo3ParamsPanel = ({
    aspectRatio,
    duration,
    resolution,
    generateAudio,
    negativePrompt,
    personGeneration,
    referenceImages,
    compressionQuality,
    resizeMode,
    onAspectRatioChange,
    onDurationChange,
    onResolutionChange,
    onGenerateAudioChange,
    onNegativePromptChange,
    onPersonGenerationChange,
    onReferenceImagesChange,
    onCompressionQualityChange,
    onResizeModeChange,
}: Veo3ParamsPanelProps) => {
    // 高级设置折叠状态
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
    // 素材参考图输入
    const [referenceInput, setReferenceInput] = useState('')

    // 处理添加素材参考图
    const handleAddReference = () => {
        const trimmed = referenceInput.trim()
        if (!trimmed) return
        
        const currentImages = referenceImages ?? []
        if (currentImages.length >= 3) return
        
        onReferenceImagesChange?.([...currentImages, trimmed])
        setReferenceInput('')
    }

    // 处理移除素材参考图
    const handleRemoveReference = (index: number) => {
        const currentImages = referenceImages ?? []
        const updated = currentImages.filter((_, i) => i !== index)
        onReferenceImagesChange?.(updated)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    unstyled
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
                >
                    <span>整合参数</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="top"
                className="w-[420px] border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
            >
                <div className="space-y-5">
                    {/* 画面比例选择 */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-300">
                            画面比例
                        </label>
                        <div className="flex gap-2">
                            {VEO3_ASPECT_RATIOS.map((item) => {
                                const isActive = aspectRatio === item.value
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => onAspectRatioChange(item.value)}
                                        className={cn(
                                            'flex flex-col items-center gap-0.5 rounded-lg border px-4 py-2 transition-all',
                                            isActive
                                                ? 'border-[#B43FEB] bg-[#B43FEB]/10'
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
                                                isActive ? 'text-[#B43FEB]' : 'text-neutral-400',
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
                                                ? 'border-[#B43FEB] bg-[#B43FEB]/10'
                                                : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'text-sm font-medium',
                                                isActive ? 'text-[#B43FEB]' : 'text-neutral-300',
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
                        <label className="text-xs font-medium text-neutral-300">
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
                                                ? 'border-[#B43FEB] bg-[#B43FEB]/10'
                                                : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'text-xs font-medium',
                                                isActive ? 'text-[#B43FEB]' : 'text-neutral-300',
                                            )}
                                        >
                                            {item.value}
                                        </span>
                                        <span
                                            className={cn(
                                                'text-[10px]',
                                                isActive ? 'text-[#B43FEB]/70' : 'text-neutral-500',
                                            )}
                                        >
                                            {item.desc}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 生成音频 */}
                    <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
                        <div className="space-y-0.5">
                            <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                                <IconVolume3 size={12} />
                                生成音频
                            </label>
                            <p className="text-[10px] text-neutral-500">
                                为视频生成 AI 音效和环境音
                            </p>
                        </div>
                        <Switch
                            checked={generateAudio ?? false}
                            onCheckedChange={(checked) => onGenerateAudioChange?.(checked)}
                            className="data-[state=checked]:bg-[#B43FEB]"
                        />
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-neutral-700" />

                    {/* 高级设置折叠区域 */}
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className="flex w-full items-center justify-between text-xs font-medium text-neutral-400 hover:text-neutral-300"
                        >
                            <span>高级设置</span>
                            <IconChevronDown
                                size={14}
                                className={cn(
                                    'transition-transform',
                                    isAdvancedOpen && 'rotate-180',
                                )}
                            />
                        </button>

                        {isAdvancedOpen && (
                            <div className="space-y-4 pl-1">
                                {/* 负面提示词 */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
                                        <IconBan size={12} />
                                        负面提示词
                                        <span className="text-[10px] text-neutral-500 ml-1">不希望出现的内容</span>
                                    </label>
                                    <Input
                                        type="text"
                                        placeholder="输入不希望在视频中出现的元素..."
                                        value={negativePrompt ?? ''}
                                        onChange={(e) => onNegativePromptChange?.(e.target.value)}
                                        className="h-8 bg-neutral-800 border-neutral-700 text-xs text-neutral-200 placeholder:text-neutral-500"
                                    />
                                </div>

                                {/* 人物生成安全设置 */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-400">
                                        人物生成安全
                                    </label>
                                    <div className="flex gap-2">
                                        {PERSON_GENERATION_OPTIONS.map((item) => {
                                            const isActive = personGeneration === item.value
                                            return (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => onPersonGenerationChange?.(item.value)}
                                                    className={cn(
                                                        'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 transition-all',
                                                        isActive
                                                            ? 'border-[#B43FEB] bg-[#B43FEB]/10'
                                                            : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'text-xs',
                                                            isActive ? 'text-[#B43FEB]' : 'text-neutral-300',
                                                        )}
                                                    >
                                                        {item.label}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'text-[10px]',
                                                            isActive ? 'text-[#B43FEB]/70' : 'text-neutral-500',
                                                        )}
                                                    >
                                                        {item.desc}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* 素材参考图 */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
                                        <IconImageInPicture size={12} />
                                        素材/风格参考图
                                        <span className="text-[10px] text-neutral-500 ml-1">最多3张</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            placeholder="输入图片 URL..."
                                            value={referenceInput}
                                            onChange={(e) => setReferenceInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddReference()
                                                }
                                            }}
                                            className="h-8 flex-1 bg-neutral-800 border-neutral-700 text-xs text-neutral-200 placeholder:text-neutral-500"
                                        />
                                        <Button
                                            type="button"
                                            variant="blue"
                                            size="sm"
                                            onClick={handleAddReference}
                                            disabled={(referenceImages?.length ?? 0) >= 3}
                                            className="h-8 px-2 text-xs"
                                        >
                                            添加
                                        </Button>
                                    </div>
                                    {/* 已添加的参考图列表 */}
                                    {referenceImages && referenceImages.length > 0 && (
                                        <div className="space-y-1.5">
                                            {referenceImages.map((url, index) => (
                                                <div
                                                    key={`${url}-${index}`}
                                                    className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800/50 px-2 py-1"
                                                >
                                                    <span className="flex-1 truncate text-[10px] text-neutral-400">
                                                        {url}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveReference(index)}
                                                        className="text-neutral-500 hover:text-red-400"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 压缩质量 */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-400">
                                        视频压缩质量
                                    </label>
                                    <div className="flex gap-2">
                                        {COMPRESSION_QUALITY_OPTIONS.map((item) => {
                                            const isActive = (compressionQuality ?? 'optimized') === item.value
                                            return (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => onCompressionQualityChange?.(item.value)}
                                                    className={cn(
                                                        'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 transition-all',
                                                        isActive
                                                            ? 'border-[#B43FEB] bg-[#B43FEB]/10'
                                                            : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'text-xs',
                                                            isActive ? 'text-[#B43FEB]' : 'text-neutral-300',
                                                        )}
                                                    >
                                                        {item.label}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'text-[10px]',
                                                            isActive ? 'text-[#B43FEB]/70' : 'text-neutral-500',
                                                        )}
                                                    >
                                                        {item.desc}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* 图片调整模式 */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-400">
                                        图片调整模式
                                    </label>
                                    <div className="flex gap-2">
                                        {RESIZE_MODE_OPTIONS.map((item) => {
                                            const isActive = (resizeMode ?? 'pad') === item.value
                                            return (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => onResizeModeChange?.(item.value)}
                                                    className={cn(
                                                        'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 transition-all',
                                                        isActive
                                                            ? 'border-[#B43FEB] bg-[#B43FEB]/10'
                                                            : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-750',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'text-xs',
                                                            isActive ? 'text-[#B43FEB]' : 'text-neutral-300',
                                                        )}
                                                    >
                                                        {item.label}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'text-[10px]',
                                                            isActive ? 'text-[#B43FEB]/70' : 'text-neutral-500',
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
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
