import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import useMessage from '@/hooks/useMessage'
import { uploadFileToOSS } from '@/utils/oss'

/**
 * 参考资源交互 Hook。
 * 封装上传参考图与断开上游连接的行为，避免主组件持有过多交互细节。
 */
export const useVideoReferenceActions = ({
  nodeId,
  edges,
  currentImageUrls,
  updateVideoNodeData,
  deleteEdge,
}: {
  nodeId: string
  edges: any[]
  currentImageUrls: string[]
  updateVideoNodeData: (nodeId: string, patch: any) => void
  deleteEdge: (edgeId: string) => void
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { success, error, warning } = useMessage()

  const handleDisconnectNode = useCallback((sourceNodeId: string) => {
    const edgeToDelete = edges.find((edge) => edge.source === sourceNodeId && edge.target === nodeId)
    if (edgeToDelete) {
      deleteEdge(edgeToDelete.id)
    }
  }, [edges, nodeId, deleteEdge])

  /**
   * 删除本地参考图（非上游节点继承）。
   * 仅从当前视频节点的 image_urls 中移除对应 URL。
   */
  const handleRemoveReferenceImage = useCallback((targetUrl: string) => {
    if (!targetUrl) {
      return
    }

    const nextUrls = (currentImageUrls ?? []).filter((url) => url !== targetUrl)
    updateVideoNodeData(nodeId, {
      image_urls: nextUrls,
    })
  }, [currentImageUrls, nodeId, updateVideoNodeData])

  const handleUploadClick = useCallback(() => {
    if (isUploading) {
      return
    }
    fileInputRef.current?.click()
  }, [isUploading])

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setIsUploading(true)

    try {
      const result = await uploadFileToOSS(file)
      const nextUrl = result.url

      if (!nextUrl) {
        warning('上传成功但未返回图片地址')
        return
      }

      updateVideoNodeData(nodeId, {
        image_urls: [...(currentImageUrls ?? []), nextUrl],
      })
      success('上传成功')
    } catch (uploadError: any) {
      console.error('上传图片失败:', uploadError)
      error('上传失败，请重试')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }, [warning, updateVideoNodeData, nodeId, currentImageUrls, success, error])

  return {
    isUploading,
    fileInputRef,
    handleDisconnectNode,
    handleRemoveReferenceImage,
    handleUploadClick,
    handleFileChange,
  }
}
