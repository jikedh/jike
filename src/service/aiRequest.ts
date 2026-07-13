import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { handleRequestError } from "shared/utils/requestErrorHandler";
import { getJikeingToken } from "shared/utils/utils";

const REQUEST_TIMEOUT = 2 * 60 * 60 * 1000;

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

const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  jikeing: {
    // 本地开发默认走本地服务，生产环境可通过 .env 覆盖为线上地址
    getBaseURL: () => JIKEING_BASE_URL,
    getToken: getJikeingToken,
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
    async (reqConfig) => {
      // 请求级 baseURL 优先，未传时再使用服务默认 baseURL
      const baseURL = reqConfig.baseURL || config.getBaseURL();
      reqConfig.baseURL = baseURL;

      if (
        typeof FormData !== "undefined" &&
        reqConfig.data instanceof FormData
      ) {
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

const jikeingRequest = async <T = any>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return await jikeingService.request(config);
};

export { jikeingService, SKIP_AUTH_HEADER };
export { jikeingRequest };
