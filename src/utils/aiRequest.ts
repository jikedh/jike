import axios, { AxiosRequestConfig, AxiosInstance } from 'axios'

// 从 utils 导入 API 密钥管理函数和环境检测函数
import { getAiToken, getZeakaiToken, getKuaiziToken, getBaseURL } from './utils'
// import { filterRequestData } from './apiFieldFilter'

// ===================== 服务基础配置 =====================

// 全局请求超时时间（单位：毫秒）
const REQUEST_TIMEOUT = 300000

// 通用请求头配置
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

// 服务配置类型
type ServiceConfig = {
  baseURL: string
  getToken: () => string
}

// 服务配置映射
const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  ai: {
    baseURL: getBaseURL('ai'), // Electron: https://toapis.com, Web: /
    getToken: getAiToken,
  },
  zeakai: {
    baseURL: getBaseURL('zeakai'), // Electron: https://zeakai-api.api4midjourney.com, Web: /
    getToken: getZeakaiToken,
  },
  kuaizi: {
    baseURL: getBaseURL('kuaizi'), // Electron: https://aiopenapi.kuaizi.cn, Web: /
    getToken: getKuaiziToken,
  },
}

// ===================== 工厂函数：创建服务实例 =====================

/**
 * 创建 axios 服务实例
 * @param serviceName 服务名称
 * @param config 服务配置
 */
const createService = (serviceName: string, config: ServiceConfig): AxiosInstance => {
  const service = axios.create({
    baseURL: config.baseURL,
    headers: { ...DEFAULT_HEADERS },
    timeout: REQUEST_TIMEOUT,
  })

  // 请求拦截器 - 动态设置 Authorization 并过滤请求数据
  service.interceptors.request.use(
    (reqConfig) => {
      const token = config.getToken()
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`
      }

      // 过滤请求数据，移除后端不需要的字段
      // if (reqConfig.data && reqConfig.url) {
      //   reqConfig.data = filterRequestData(reqConfig.url, reqConfig.data)
      // }

      return reqConfig
    },
    (error) => Promise.reject(error)
  )

  // 响应拦截器 - 直接返回 response.data
  service.interceptors.response.use(
    (response) => response.data,
    (error) => Promise.reject(error)
  )

  return service
}

// ===================== 创建服务实例 =====================

const aiService = createService('ai', SERVICE_CONFIGS.ai)
const zeakaiService = createService('zeakai', SERVICE_CONFIGS.zeakai)
const kuaiziService = createService('kuaizi', SERVICE_CONFIGS.kuaizi)

// ===================== 请求方法封装 =====================

/**
 * AI 服务请求方法
 */
const aiRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await aiService.request(config)
}

/**
 * ZeakAI 服务请求方法
 */
const zeakaiRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await zeakaiService.request(config)
}

/**
 * 快手 AI 服务请求方法
 */
const kuaiziRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await kuaiziService.request(config)
}

// ===================== 导出 =====================

export { aiService, zeakaiService, kuaiziService }
export default aiRequest
export { zeakaiRequest, kuaiziRequest }
