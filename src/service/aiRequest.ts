import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { handleRequestError } from "shared/utils/requestErrorHandler";
import {
  getAiToken,
  getBaseURL,
  getJikeingToken,
  getKuaiziToken,
  getYunwuToken,
  getZeakaiToken,
  getDashscopeToken,
} from "shared/utils/utils";

const REQUEST_TIMEOUT = 300000;

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

type ServiceConfig = {
  getBaseURL: () => string;
  getToken: () => string;
  authHeader?: string;
  useBearer?: boolean;
};

const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  ai: {
    getBaseURL: () => getBaseURL("ai"),
    getToken: getAiToken,
  },
  zeakai: {
    getBaseURL: () => getBaseURL("zeakai"),
    getToken: getZeakaiToken,
  },
  kuaizi: {
    getBaseURL: () => getBaseURL("kuaizi"),
    getToken: getKuaiziToken,
    authHeader: "ApiKey",
    useBearer: false,
  },
  jikeing: {
    // getBaseURL: () => 'https://api.jikeing.com',
    getBaseURL: () => "https://api-v2.jikeing.com",
    getToken: getJikeingToken,
    authHeader: "x-token",
    useBearer: false,
  },
  yunwu: {
    getBaseURL: () => "https://yunwu.ai",
    getToken: getYunwuToken,
  },
  dashscope: {
    getBaseURL: () => "https://dashscope.aliyuncs.com/compatible-mode/v1",
    getToken: getDashscopeToken,
  },
  jikeingAdmin: {
    getBaseURL: () => "https://api-admin.jikeing.com",
    getToken: () =>
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbiIsImxvZ2luSWQiOjMsInJuU3RyIjoiVmJ0OVh5QU9nU2JaOVNNVks1TjNYVDA2SzI1UlZnZE4iLCJyb2xlSWQiOjR9.zY0yNhz_UZhNoFYphb_VjOnlGSh7h2RRkJtjF8Qyqqs",
    authHeader: "x-token",
    useBearer: false,
  },
};

const createService = (
  serviceName: string,
  config: ServiceConfig,
): AxiosInstance => {
  const service = axios.create({
    headers: { ...DEFAULT_HEADERS },
    timeout: REQUEST_TIMEOUT,
  });

  service.interceptors.request.use(
    (reqConfig) => {
      // 请求级 baseURL 优先，未传时再使用服务默认 baseURL
      const baseURL = reqConfig.baseURL || config.getBaseURL();
      reqConfig.baseURL = baseURL;

      const token = config.getToken();
      if (token) {
        const headerName = config.authHeader || "Authorization";
        const headerValue =
          config.useBearer !== false ? `Bearer ${token}` : token;
        reqConfig.headers[headerName] = headerValue;
      }

      return reqConfig;
    },
    (error) => Promise.reject(error),
  );

  service.interceptors.response.use(
    (response) => response.data,
    (error) => {
      handleRequestError(error);
      return Promise.reject(error);
    },
  );

  return service;
};

const aiService = createService("ai", SERVICE_CONFIGS.ai);
const zeakaiService = createService("zeakai", SERVICE_CONFIGS.zeakai);
const kuaiziService = createService("kuaizi", SERVICE_CONFIGS.kuaizi);
const jikeingService = createService("jikeing", SERVICE_CONFIGS.jikeing);
const yunwuService = createService("yunwu", SERVICE_CONFIGS.yunwu);
const dashscopeService = createService("dashscope", SERVICE_CONFIGS.dashscope);
const jikeingAdminService = createService(
  "jikeingAdmin",
  SERVICE_CONFIGS.jikeingAdmin,
);

const aiRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await aiService.request(config);
};

const zeakaiRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await zeakaiService.request(config);
};

const kuaiziRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await kuaiziService.request(config);
};

const jikeingRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await jikeingService.request(config);
};

const yunwuRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await yunwuService.request(config);
};

const dashscopeRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await dashscopeService.request(config);
};

const jikeingAdminRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await jikeingAdminService.request(config);
};

export {
  aiService,
  zeakaiService,
  kuaiziService,
  jikeingService,
  yunwuService,
  dashscopeService,
  jikeingAdminService,
};
export default aiRequest;
export {
  zeakaiRequest,
  kuaiziRequest,
  jikeingRequest,
  yunwuRequest,
  dashscopeRequest,
  jikeingAdminRequest,
};
