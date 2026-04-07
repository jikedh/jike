/**
 * Jikeing API 类型定义
 */

export interface SceneQrcodeResponse {
  scene_id: string
  qrcode_image: string
}

export interface LoginResponse {
  code: number
  msg?: string
  modal?: boolean
  timestamp?: number
  data?: {
    id: string
    token: string
    expireAt: number
    status: number
  }
}
