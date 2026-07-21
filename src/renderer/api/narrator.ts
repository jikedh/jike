import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  NarratorApiEnvelope,
  NarratorCreateTaskRequest,
  NarratorCreateTaskResponse,
  NarratorMaterial,
  NarratorMaterialPage,
  NarratorModelOptions,
  NarratorOptionItem,
  NarratorTaskDetail,
} from "shared/types/api/narrator";

const NARRATOR_API_BASE_URL = (
  import.meta.env.VITE_NARRATOR_API_BASE_URL || "https://openapi.jieshuo.cn"
).replace(/\/+$/, "");

const NARRATOR_API_KEY = import.meta.env.VITE_NARRATOR_API_KEY || "";

const MODEL_LABELS: Record<string, string> = {
  ai_model_v1: "六脉神剑",
  ai_model_v4: "六脉神剑",
};

const DEFAULT_FONT_STYLE_OPTIONS: NarratorOptionItem[] = [
  { name: "白底黑边", value: "白底黑边" },
  { name: "白字棕变", value: "白字棕变" },
  { name: "黄字粗黑边", value: "黄字粗黑边" },
  { name: "黑底白字", value: "黑底白字" },
  { name: "橙底黑字", value: "橙底黑字" },
  { name: "黑底白字彩边", value: "黑底白字彩边" },
];

const ensureApiKey = () => {
  if (!NARRATOR_API_KEY.trim()) {
    throw new Error("未配置 VITE_NARRATOR_API_KEY");
  }
};

const getErrorMessage = (payload: NarratorApiEnvelope<unknown>) => {
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  return String(
    payload.message ||
      payload.msg ||
      data.error ||
      data.message ||
      "解说接口请求失败",
  );
};

const requestNarratorApi = async <T>(
  path: string,
  init?: RequestInit,
): Promise<NarratorApiEnvelope<T>> => {
  ensureApiKey();

  const response = await tauriFetch(`${NARRATOR_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "app-key": NARRATOR_API_KEY,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json()) as NarratorApiEnvelope<T>;
  const successCode = payload.code === 0 || payload.code === 10000;

  if (!response.ok || !successCode) {
    throw new Error(getErrorMessage(payload));
  }

  return payload;
};

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const normalizeOptionItems = (value: unknown): NarratorOptionItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): NarratorOptionItem | null => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const name = String(raw.name || raw.label || raw.value || "").trim();
      const optionValue = String(
        raw.value || raw.name || raw.label || "",
      ).trim();
      if (!name || !optionValue) return null;

      return {
        name,
        value: optionValue,
        avatar_url: raw.avatar_url ? String(raw.avatar_url) : undefined,
        res_url: raw.res_url ? String(raw.res_url) : undefined,
      };
    })
    .filter((item): item is NarratorOptionItem => Boolean(item));
};

export const normalizeNarratorModelOptions = (
  data: unknown,
): NarratorModelOptions[] => {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data as Record<string, unknown>)
    .map(([id, value]) => {
      if (!value || typeof value !== "object") return null;
      const raw = value as Record<string, unknown>;
      const subtitleStyle =
        raw.subtitle_style &&
        typeof raw.subtitle_style === "object" &&
        !Array.isArray(raw.subtitle_style)
          ? (raw.subtitle_style as Record<string, unknown>)
          : {};
      const subtitleStyleOptions = Array.isArray(raw.subtitle_style)
        ? raw.subtitle_style
        : subtitleStyle.font_size;

      return {
        id,
        label: String(raw.name || raw.label || MODEL_LABELS[id] || id),
        fontSize: normalizeOptionItems(
          raw.font_size || subtitleStyleOptions,
        ),
        fontStyle: normalizeOptionItems(
          raw.font_style || subtitleStyle.font_style,
        ).length > 0
          ? normalizeOptionItems(raw.font_style || subtitleStyle.font_style)
          : DEFAULT_FONT_STYLE_OPTIONS,
        dubbing: normalizeOptionItems(raw.dubbing),
        cover: normalizeOptionItems(raw.cover),
        bgm: normalizeOptionItems(raw.bgm),
      };
    })
    .filter((item): item is NarratorModelOptions => Boolean(item));
};

export const isNarratorApiConfigured = () => Boolean(NARRATOR_API_KEY.trim());

export const getNarratorMaterials = async ({
  name,
  page = 1,
  limit = 20,
}: {
  name?: string;
  page?: number;
  limit?: number;
}): Promise<NarratorMaterialPage> => {
  const payload = await requestNarratorApi<NarratorMaterial[]>(
    `/api/v1/materials${toQueryString({ name, page, limit })}`,
  );

  return {
    items: Array.isArray(payload.data) ? payload.data : [],
    total: Number(payload.total || 0),
    limit: Number(payload.limit || limit),
    page: Number(payload.page || page),
  };
};

export const getNarratorModelOptions = async () => {
  const payload = await requestNarratorApi<Record<string, unknown>>(
    "/api/v1/material/options",
  );
  return normalizeNarratorModelOptions(payload.data);
};

export const createNarratorTask = async (
  request: NarratorCreateTaskRequest,
): Promise<NarratorCreateTaskResponse> => {
  const payload = await requestNarratorApi<NarratorCreateTaskResponse>(
    "/api/v1/task",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );

  if (!payload.data?.task_num) {
    throw new Error("创建任务成功，但响应缺少任务编号");
  }

  return payload.data;
};

export const getNarratorTask = async (
  taskNum: string,
): Promise<NarratorTaskDetail> => {
  const payload = await requestNarratorApi<NarratorTaskDetail>(
    `/api/v1/task/${encodeURIComponent(taskNum)}`,
  );

  if (!payload.data?.task_num) {
    throw new Error("任务详情响应缺少任务编号");
  }

  return payload.data;
};
