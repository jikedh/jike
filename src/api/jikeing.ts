import axios, { AxiosInstance, AxiosError } from 'axios'

const JIKEING_TOKEN_KEY = 'userToken'
const JIKEING_USER_ID_KEY = 'jikeing_user_id'
const JIKEING_API_BASE_URL = 'https://api.jikeing.com'

export function getJikeingToken(): string {
  return localStorage.getItem(JIKEING_TOKEN_KEY) || ''
}

export function setJikeingToken(token: string): void {
  localStorage.setItem(JIKEING_TOKEN_KEY, token)
}

export function clearJikeingToken(): void {
  localStorage.removeItem(JIKEING_TOKEN_KEY)
  localStorage.removeItem(JIKEING_USER_ID_KEY)
}

export function getJikeingUserId(): string {
  return localStorage.getItem(JIKEING_USER_ID_KEY) || ''
}

export function setJikeingUserId(userId: string | number): void {
  localStorage.setItem(JIKEING_USER_ID_KEY, String(userId))
}

interface ApiResponse<T = unknown> {
  code: number
  msg?: string
  data?: T
}

interface QrcodeData {
  scene_id: string
  qrcode_image: string
}

interface LoginData {
  id: number
  token: string
  expireAt: number
  status: number
}

const jikeingService: AxiosInstance = axios.create({
  baseURL: JIKEING_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

jikeingService.interceptors.request.use(
  (config) => {
    const token = getJikeingToken()
    if (token) {
      config.headers['x-token'] = token
    }
    console.log('[jikeing] request:', config.url)
    return config
  },
  (error) => Promise.reject(error)
)

jikeingService.interceptors.response.use(
  (response) => {
    console.log('[jikeing] response:', response.config.url, response.data)
    return response.data
  },
  (error: AxiosError) => {
    console.error('[jikeing] request error:', error.message)
    if (error.response) {
      console.error('[jikeing] response status:', error.response.status)
      console.error('[jikeing] response data:', error.response.data)
    }
    return Promise.reject(error)
  }
)

export interface SceneQrcodeResponse {
  scene_id: string
  qrcode_image: string
}

export interface LoginResponse {
  code: number
  msg?: string
  data?: LoginData
}

export async function getSceneQrcode(): Promise<SceneQrcodeResponse> {
  try {
    const res = await jikeingService.get<unknown, ApiResponse<QrcodeData>>('/v1/user/get-scene-qrcode')
    
    if (!res || res.code !== 200) {
      throw new Error(res?.msg || '获取二维码失败')
    }
    
    if (!res.data) {
      throw new Error('响应数据为空')
    }
    
    let qrcodeImage = res.data.qrcode_image || ''
    qrcodeImage = qrcodeImage.trim().replace(/`/g, '').trim()
    
    if (!qrcodeImage) {
      throw new Error('二维码图片为空')
    }
    
    return {
      scene_id: res.data.scene_id,
      qrcode_image: qrcodeImage
    }
  } catch (error) {
    console.error('[jikeing] getSceneQrcode error:', error)
    throw error
  }
}

export async function querySceneStatus(sceneId: string): Promise<LoginResponse> {
  try {
    const res = await jikeingService.get<unknown, ApiResponse<LoginData>>('/v1/user/query-scene-status', {
      params: { scene_id: sceneId }
    })
    return res as LoginResponse
  } catch (error) {
    console.error('[jikeing] querySceneStatus error:', error)
    throw error
  }
}

export default jikeingService
