/**
 * 上传图片 - 请求体类型
 */
export interface UploadImageRequest {
  file: File; // 图片文件（必填），支持的格式：JPEG (.jpg, .jpeg)、PNG (.png)、WebP (.webp)、GIF (.gif)，限制：最大文件大小 10MB
  purpose?: string; // 上传目的（可选），默认值：generation
}

/**
 * 上传图片 - 响应体类型
 */
export interface UploadImageResponse {
  // 直接内联定义嵌套对象
  data: {
    id: string; // 上传图片的唯一标识
    url: string; // 上传成功的图片 URL
    mime_type: string; // 图片 MIME 类型
    size: number; // 图片尺寸（字节）
  }; // 响应数据
  message: string; // 响应消息
  success: boolean; // 是否成功
}
