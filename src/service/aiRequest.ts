import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { handleRequestError } from "shared/utils/requestErrorHandler";
import {
  getAiToken,
  getBaseURL,
  getDashscopeToken,
  getJikeingToken,
  getKuaiziToken,
  getYunwuToken,
  getZeakaiToken,
} from "shared/utils/utils";
import type { Flow2ApiState } from "shared/types/flow2api";

const REQUEST_TIMEOUT = 300000;

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

// Jikeing 服务默认地址：优先使用环境变量，方便本地开发切换到本地后端
const JIKEING_BASE_URL =
  import.meta.env.VITE_JIKEING_BASE_URL || "http://localhost:9001";

type ServiceConfig = {
  getBaseURL: () => string;
  getToken: () => string;
  authHeader?: string;
  useBearer?: boolean;
};

async function getFlow2ApiState(): Promise<Flow2ApiState | null> {
  if (typeof window === "undefined" || !window.flow2api) {
    return null;
  }

  try {
    return await window.flow2api.getState();
  } catch {
    return null;
  }
}

function normalizeBaseUrl(url: string | undefined): string {
  return (url || "").replace(/\/+$/, "");
}

function toHeaderRecord(
  headers: AxiosRequestConfig["headers"],
): Record<string, string> {
  if (!headers) {
    return {};
  }

  return headers as Record<string, string>;
}

async function applyFlow2ApiAuth(reqConfig: AxiosRequestConfig): Promise<void> {
  const flow2ApiState = await getFlow2ApiState();
  if (
    flow2ApiState?.status !== "running" ||
    !flow2ApiState.baseUrl ||
    !flow2ApiState.apiKey
  ) {
    return;
  }

  const requestBaseUrl = normalizeBaseUrl(reqConfig.baseURL);
  const flow2ApiBaseUrl = normalizeBaseUrl(flow2ApiState.baseUrl);
  if (!requestBaseUrl || requestBaseUrl !== flow2ApiBaseUrl) {
    return;
  }

  const headerRecord = toHeaderRecord(reqConfig.headers);
  reqConfig.headers = headerRecord;
  const hasAuthorization = Object.keys(headerRecord).some(
    (key) => key.toLowerCase() === "authorization",
  );
  const hasGoogApiKey = Object.keys(headerRecord).some(
    (key) => key.toLowerCase() === "x-goog-api-key",
  );

  if (!hasAuthorization) {
    headerRecord.Authorization = `Bearer ${flow2ApiState.apiKey}`;
  }

  // 同时补一个官方兼容头，避免本地服务在某些场景下没有正确读取 Authorization。
  if (!hasGoogApiKey) {
    headerRecord["x-goog-api-key"] = flow2ApiState.apiKey;
  }
}

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
    // 本地开发默认走本地服务，生产环境可通过 .env 覆盖为线上地址
    getBaseURL: () => JIKEING_BASE_URL,
    getToken: getJikeingToken,
    authHeader: "x-token",
    useBearer: false,
  },
  yunwu: {
    getBaseURL: () => "https://yunwu.ai",
    getToken: getYunwuToken,
  },
  dashscope: {
    getBaseURL: () => "/dashscope-api",
    getToken: getDashscopeToken,
  },
  jikeingAdmin: {
    getBaseURL: () => "https://api-admin.jikeing.com",
    getToken: () =>
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbiIsImxvZ2luSWQiOjMsInJuU3RyIjoiVmJ0OVh5QU9nU2JaOVNNVks1TjNYVDA2SzI1UlZnZE4iLCJyb2xlSWQiOjR9.zY0yNhz_UZhNoFYphb_VjOnlGSh7h2RRkJtjF8Qyqqs",
    authHeader: "x-token",
    useBearer: false,
  },
  wuhen: {
    getBaseURL: () => "https://api.wuhenai.com",
    getToken: () => "",
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
    async (reqConfig) => {
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

      await applyFlow2ApiAuth(reqConfig);

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
const wuhenService = createService("wuhen", SERVICE_CONFIGS.wuhen);

const aiRequest = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return await aiService.request(config);
};

const flow2ApiRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  const flow2ApiState = await getFlow2ApiState();
  const nextConfig = { ...config };

  if (flow2ApiState?.baseUrl) {
    nextConfig.baseURL = flow2ApiState.baseUrl;
  }

  await applyFlow2ApiAuth(nextConfig);

  const finalConfig: AxiosRequestConfig = {
    ...nextConfig,
    timeout: REQUEST_TIMEOUT,
    headers: {
      ...DEFAULT_HEADERS,
      ...toHeaderRecord(nextConfig.headers),
    },
  };

  return await axios(finalConfig).then((response) => response.data);
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

const wuhenRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await wuhenService.request(config);
};

export {
  aiService,
  zeakaiService,
  kuaiziService,
  jikeingService,
  yunwuService,
  dashscopeService,
  jikeingAdminService,
  wuhenService,
  flow2ApiRequest,
  getFlow2ApiState,
};
export default aiRequest;
export {
  zeakaiRequest,
  kuaiziRequest,
  jikeingRequest,
  yunwuRequest,
  dashscopeRequest,
  jikeingAdminRequest,
  wuhenRequest,
};
