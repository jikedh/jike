import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ===================== localStorage API 密钥管理 =====================

// localStorage 中存储 API 密钥的键名
const AI_TOKEN_KEY = 'yunyun_ai_token'
const ZEAKAI_TOKEN_KEY = 'yunyun_zeakai_token'
const KUAIZI_TOKEN_KEY = 'yunyun_kuaizi_token'

// 写死的默认服务密钥（用户首次使用时自动生效）
// TODO: 请替换为实际的密钥值
const DEFAULT_AI_TOKEN = 'sk-8ngj8WD671ZFioHc2qypEJFQwhWeims435RtteF28IPxgHWR'
const DEFAULT_ZEAKAI_TOKEN = 'df3ddeb9-45da-4eb7-b49a-8ab32c8e4ebb'
const DEFAULT_KUAIZI_TOKEN = 'kz-XyWCfLd8q784ybb6PVo6OuDb2rkRJ8ShiCZNcvnus0'

/**
 * 获取 AI 服务密钥
 * 优先从 localStorage 获取，如果没有则返回写死的默认值
 */
export function getAiToken(): string {
  return localStorage.getItem(AI_TOKEN_KEY) || DEFAULT_AI_TOKEN
}

/**
 * 设置 AI 服务密钥
 */
export function setAiToken(token: string): void {
  localStorage.setItem(AI_TOKEN_KEY, token)
}

/**
 * 获取 ZeakAI 服务密钥
 * 优先从 localStorage 获取，如果没有则返回写死的默认值
 */
export function getZeakaiToken(): string {
  return localStorage.getItem(ZEAKAI_TOKEN_KEY) || DEFAULT_ZEAKAI_TOKEN
}

/**
 * 设置 ZeakAI 服务密钥
 */
export function setZeakaiToken(token: string): void {
  localStorage.setItem(ZEAKAI_TOKEN_KEY, token)
}

/**
 * 检查是否已配置 API 密钥
 */
export function hasAiToken(): boolean {
  return !!getAiToken()
}

export function hasZeakaiToken(): boolean {
  return !!getZeakaiToken()
}

/**
 * 获取快手 AI 服务密钥
 * 优先从 localStorage 获取，如果没有则返回写死的默认值
 */
export function getKuaiziToken(): string {
  return localStorage.getItem(KUAIZI_TOKEN_KEY) || DEFAULT_KUAIZI_TOKEN
}

/**
 * 设置快手 AI 服务密钥
 */
export function setKuaiziToken(token: string): void {
  localStorage.setItem(KUAIZI_TOKEN_KEY, token)
}

/**
 * 检查是否已配置快手 AI 服务密钥
 */
export function hasKuaiziToken(): boolean {
  return !!getKuaiziToken()
}


// ===================== 环境检测与基础URL配置 =====================

/**
 * 检测是否在 Electron 环境中运行
 */
export const isElectron = (): boolean => {
  if (typeof window !== 'undefined' && (window as any).electron) {
    console.log('[isElectron] detected via window.electron')
    return true
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) {
    console.log('[isElectron] detected via userAgent')
    return true
  }
  return false
}

/**
 * 获取基础 URL
 * - Electron 环境：使用完整的 API 地址
 * - Web 环境：使用相对路径（由 Vite 代理或 Nginx 代理处理）
 */
export const getBaseURL = (apiPath: string): string => {
  const electronMode = isElectron()
  console.log('[getBaseURL] apiPath:', apiPath, '| isElectron:', electronMode)
  
  if (electronMode) {
    const apiServers: Record<string, string> = {
      ai: 'https://toapis.com',
      zeakai: 'https://zeakai-api.api4midjourney.com',
      kuaizi: 'https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1',
    }
    return apiServers[apiPath] || '/'
  }
  return '/'
}
