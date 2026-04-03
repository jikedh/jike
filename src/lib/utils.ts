import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
