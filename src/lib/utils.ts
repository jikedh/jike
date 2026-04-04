import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect } from '@tiptap/react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 中文数字常量 */
const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 将数字转成中文数字（支持 1~99），用于"图片一/图片二"标签
 * @param num 要转换的数字（支持 1~99）
 * @returns 中文数字字符串，如 1 -> "一"，15 -> "十五"
 */
export const toChineseNumber = (num: number): string => {
  if (num <= 10) {
    return num === 10 ? '十' : CHINESE_DIGITS[num]
  }

  if (num < 20) {
    return `十${CHINESE_DIGITS[num % 10]}`
  }

  if (num < 100) {
    const ten = Math.floor(num / 10)
    const one = num % 10
    return `${CHINESE_DIGITS[ten]}十${one === 0 ? '' : CHINESE_DIGITS[one]}`
  }

  return `${num}`
}

/**
 * 从 mention 节点属性中获取标签文本
 * @param attrs mention 节点属性，包含 id、label、value
 * @returns 标签文本，优先返回 label，其次 value，最后 id
 */
export const getMentionLabel = (attrs: { id?: string; label?: string; value?: string }): string => {
  return attrs.label || attrs.value || attrs.id || ''
}

/**
 * 使用 Floating UI 更新 suggestion 下拉列表位置
 * @param editor Tiptap 编辑器实例
 * @param element 需要定位的 DOM 元素
 */
export const updateSuggestionPosition = (editor: { view: any; state: { selection: { from: number; to: number } } }, element: HTMLElement) => {
  // 创建虚拟元素（光标位置）
  const virtualElement = {
    getBoundingClientRect: () => posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to),
  }

  // 计算位置
  computePosition(virtualElement, element, {
    placement: 'bottom-start',
    strategy: 'absolute',
    middleware: [shift(), flip()],
  }).then(({ x, y, strategy }) => {
    element.style.width = 'max-content'
    element.style.minWidth = '240px'
    element.style.maxWidth = '320px'
    element.style.position = strategy
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

/**
 * 从网络 URL 下载图片
 * @param imageUrl 图片 URL
 * @param filename 可选的文件名，如果不提供则从 URL 自动提取或使用时间戳生成
 * @throws 网络错误或下载失败时抛出错误
 */
export async function downloadImageFromUrl(imageUrl: string, filename?: string): Promise<void> {
  try {
    // 获取图片 blob
    const response = await fetch(imageUrl, { mode: 'cors' })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()

    // 生成文件名
    let finalFilename = filename

    if (!finalFilename) {
      // 尝试从 URL 提取文件名
      try {
        const url = new URL(imageUrl)
        const pathname = url.pathname
        const basename = pathname.split('/').pop()

        if (basename && basename.includes('.')) {
          finalFilename = basename
        }
      } catch {
        // URL 解析失败，使用时间戳降级方案
      }

      // 如果无法从 URL 提取文件名，使用时间戳 + 扩展名
      if (!finalFilename) {
        const ext = blob.type.split('/')[1] || 'jpg'
        finalFilename = `image-${Date.now()}.${ext}`
      }
    }

    // 创建对象 URL 并下载
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = finalFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // 清理对象 URL
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    throw new Error(`下载失败: ${message}`)
  }
}
