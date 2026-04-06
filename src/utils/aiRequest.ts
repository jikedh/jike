import axios, { AxiosRequestConfig, AxiosInstance } from 'axios'

import { getAiToken, getZeakaiToken, getKuaiziToken, getBaseURL } from './utils'
import { handleRequestError } from './requestErrorHandler'

const REQUEST_TIMEOUT = 300000

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

type ServiceConfig = {
  getBaseURL: () => string
  getToken: () => string
  authHeader?: string
  useBearer?: boolean
}

const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  ai: {
    getBaseURL: () => getBaseURL('ai'),
    getToken: getAiToken,
  },
  zeakai: {
    getBaseURL: () => getBaseURL('zeakai'),
    getToken: getZeakaiToken,
  },
  kuaizi: {
    getBaseURL: () => getBaseURL('kuaizi'),
    getToken: getKuaiziToken,
    authHeader: 'ApiKey',
    useBearer: false,
  },
}

const createService = (serviceName: string, config: ServiceConfig): AxiosInstance => {
  const service = axios.create({
    headers: { ...DEFAULT_HEADERS },
    timeout: REQUEST_TIMEOUT,
  })

  service.interceptors.request.use(
    (reqConfig) => {
      const baseURL = config.getBaseURL()
      reqConfig.baseURL = baseURL

      console.log(`[${serviceName}] baseURL:`, baseURL, '| url:', reqConfig.url)

      const token = config.getToken()
      if (token) {
        const headerName = config.authHeader || 'Authorization'
        const headerValue = config.useBearer !== false ? `Bearer ${token}` : token
        reqConfig.headers[headerName] = headerValue
      }

      return reqConfig
    },
    (error) => Promise.reject(error)
  )

  service.interceptors.response.use(
    (response) => response.data,
    (error) => {
      handleRequestError(error)
      return Promise.reject(error)
    }
  )

  return service
}

const aiService = createService('ai', SERVICE_CONFIGS.ai)
const zeakaiService = createService('zeakai', SERVICE_CONFIGS.zeakai)
const kuaiziService = createService('kuaizi', SERVICE_CONFIGS.kuaizi)

const aiRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await aiService.request(config)
}

const zeakaiRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await zeakaiService.request(config)
}

const kuaiziRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await kuaiziService.request(config)
}

export { aiService, zeakaiService, kuaiziService }
export default aiRequest
export { zeakaiRequest, kuaiziRequest }
