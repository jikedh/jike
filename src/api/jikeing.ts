import axios, { AxiosInstance } from 'axios'

const JIKEING_TOKEN_KEY = 'jikeing_token'
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
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

jikeingService.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code === 200 && res.data) {
      return res.data
    }
    return res
  },
  (error) => {
    console.error('[jikeing] request error:', error)
    return Promise.reject(error)
  }
)

export interface SceneQrcodeResponse {
  scene_id: string
  qrcode_image: string
}

export interface LoginResponse {
  id: number
  token: string
  expireAt: number
  status: number
}

export async function getSceneQrcode(): Promise<SceneQrcodeResponse> {
  const res = await jikeingService.get('/v1/user/get-scene-qrcode')
  return {
    scene_id: res.data.scene_id,
    qrcode_image: res.data.qrcode_image?.trim().replace(/^`|`$/g, '')
  }
}

export function querySceneStatus(sceneId: string): Promise<LoginResponse> {
  return jikeingService.get('/v1/user/query-scene-status', {
    params: { scene_id: sceneId }
  })
}

export default jikeingService
