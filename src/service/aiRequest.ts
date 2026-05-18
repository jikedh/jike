import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { handleRequestError } from "shared/utils/requestErrorHandler";
import { getJikeingToken } from "shared/utils/utils";
import type { Adobe2ApiState } from "shared/types/adobe2api";
import type { Grok2ApiState } from "shared/types/grok2api";

const REQUEST_TIMEOUT = 300000;

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};
const SKIP_AUTH_HEADER = "X-Skip-Jikeing-Token";

// Jikeing 服务默认地址：优先使用环境变量，方便本地开发切换到本地后端
const JIKEING_BASE_URL =
  import.meta.env.VITE_JIKEING_BASE_URL || "http://localhost:9001";

type ServiceConfig = {
  getBaseURL: () => string;
  getToken: () => string;
  authHeader?: string;
  useBearer?: boolean;
};

async function getAdobe2ApiState(): Promise<Adobe2ApiState | null> {
  if (typeof window === "undefined" || !window.adobe2api) {
    return null;
  }

  try {
    return await window.adobe2api.getState();
  } catch {
    return null;
  }
}

async function getGrok2ApiState(): Promise<Grok2ApiState | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    if (window.grok2api) {
      return await window.grok2api.getState();
    }

    const ipcRenderer = (window as any).electron?.ipcRenderer;
    if (typeof ipcRenderer?.invoke === "function") {
      return await ipcRenderer.invoke("grok2api:getState");
    }
  } catch {
    return null;
  }

  return null;
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

function applyAdobe2ApiHeaders(
  reqConfig: AxiosRequestConfig,
  apiKey: string,
): void {
  const headerRecord = toHeaderRecord(reqConfig.headers);
  reqConfig.headers = headerRecord;
  headerRecord.Authorization = `Bearer ${apiKey}`;
  headerRecord["x-api-key"] = apiKey;
}

async function applyAdobe2ApiAuth(reqConfig: AxiosRequestConfig): Promise<void> {
  const adobe2ApiState = await getAdobe2ApiState();
  if (
    !adobe2ApiState?.baseUrl ||
    !adobe2ApiState.apiKey
  ) {
    return;
  }

  const requestBaseUrl = normalizeBaseUrl(reqConfig.baseURL);
  const adobe2ApiBaseUrl = normalizeBaseUrl(adobe2ApiState.baseUrl);
  if (!requestBaseUrl || requestBaseUrl !== adobe2ApiBaseUrl) {
    return;
  }

  applyAdobe2ApiHeaders(reqConfig, adobe2ApiState.apiKey);
}

function applyGrok2ApiHeaders(
  reqConfig: AxiosRequestConfig,
  apiKey: string,
): void {
  const headerRecord = toHeaderRecord(reqConfig.headers);
  reqConfig.headers = headerRecord;
  headerRecord.Authorization = `Bearer ${apiKey}`;
}

async function applyGrok2ApiAuth(reqConfig: AxiosRequestConfig): Promise<void> {
  const grok2ApiState = await getGrok2ApiState();
  if (!grok2ApiState?.baseUrl || !grok2ApiState.apiKey) {
    return;
  }

  const requestBaseUrl = normalizeBaseUrl(reqConfig.baseURL);
  const grok2ApiBaseUrl = normalizeBaseUrl(grok2ApiState.baseUrl);
  if (!requestBaseUrl || requestBaseUrl !== grok2ApiBaseUrl) {
    return;
  }

  applyGrok2ApiHeaders(reqConfig, grok2ApiState.apiKey);
}

const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  jikeing: {
    // 本地开发默认走本地服务，生产环境可通过 .env 覆盖为线上地址
    getBaseURL: () => JIKEING_BASE_URL,
    getToken: getJikeingToken,
    authHeader: "x-token",
    useBearer: false,
  },
  wuhen: {
    getBaseURL: () => "https://api.wuhenai.com",
    getToken: () => "",
  },
  ximu: {
    getBaseURL: () => "https://shengtu.ximuai.com",
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

      if (typeof FormData !== "undefined" && reqConfig.data instanceof FormData) {
        delete reqConfig.headers["Content-Type"];
        delete reqConfig.headers["content-type"];
      }

      const shouldSkipAuth = reqConfig.headers?.[SKIP_AUTH_HEADER] === "true";
      if (shouldSkipAuth) {
        delete reqConfig.headers[SKIP_AUTH_HEADER];
      }

      const token = shouldSkipAuth ? "" : config.getToken();
      if (token) {
        const headerName = config.authHeader || "Authorization";
        const headerValue =
          config.useBearer !== false ? `Bearer ${token}` : token;
        reqConfig.headers[headerName] = headerValue;
      }

      await applyAdobe2ApiAuth(reqConfig);
      await applyGrok2ApiAuth(reqConfig);

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

const jikeingService = createService("jikeing", SERVICE_CONFIGS.jikeing);
const wuhenService = createService("wuhen", SERVICE_CONFIGS.wuhen);
const ximuService = createService("ximu", SERVICE_CONFIGS.ximu);

const adobe2ApiRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  const adobe2ApiState = await getAdobe2ApiState();
  const nextConfig = { ...config };

  if (adobe2ApiState?.baseUrl) {
    nextConfig.baseURL = adobe2ApiState.baseUrl;
  }

  await applyAdobe2ApiAuth(nextConfig);

  const finalConfig: AxiosRequestConfig = {
    ...nextConfig,
    timeout: nextConfig.timeout ?? REQUEST_TIMEOUT,
    headers: {
      ...DEFAULT_HEADERS,
      ...toHeaderRecord(nextConfig.headers),
    },
  };

  return await axios(finalConfig).then((response) => response.data);
};

const grok2ApiRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  const grok2ApiState = await getGrok2ApiState();
  const nextConfig = { ...config };

  if (grok2ApiState?.baseUrl) {
    nextConfig.baseURL = grok2ApiState.baseUrl;
  }

  await applyGrok2ApiAuth(nextConfig);

  const headerRecord = {
    ...DEFAULT_HEADERS,
    ...toHeaderRecord(nextConfig.headers),
  };
  if (typeof FormData !== "undefined" && nextConfig.data instanceof FormData) {
    delete headerRecord["Content-Type"];
    delete headerRecord["content-type"];
  }

  const finalConfig: AxiosRequestConfig = {
    ...nextConfig,
    timeout: nextConfig.timeout ?? REQUEST_TIMEOUT,
    headers: headerRecord,
  };

  return await axios(finalConfig).then((response) => response.data);
};

const jikeingRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await jikeingService.request(config);
};

const wuhenRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await wuhenService.request(config);
};

const ximuRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await ximuService.request(config);
};

export {
  jikeingService,
  wuhenService,
  ximuService,
  adobe2ApiRequest,
  getAdobe2ApiState,
  grok2ApiRequest,
  getGrok2ApiState,
  SKIP_AUTH_HEADER,
};
export {
  jikeingRequest,
  wuhenRequest,
  ximuRequest,
};
