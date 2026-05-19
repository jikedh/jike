import { SKIP_AUTH_HEADER } from "service/aiRequest";
import { getJikeingToken } from "shared/utils/utils";

export const JIKE_GO_BASE_URL =
  import.meta.env.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";

export const getJikeGoAuthHeaders = () => {
  const token = getJikeingToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getJikeGoAiProxyHeaders = () => ({
  ...getJikeGoAuthHeaders(),
  [SKIP_AUTH_HEADER]: "true",
});
