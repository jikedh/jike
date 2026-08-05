const STORAGE_KEY = "jike.video-to-script.state.v1";

export type VideoToScriptPersistedState = {
  model?: string;
  results: unknown[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const loadVideoToScriptState = (): VideoToScriptPersistedState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { results: [] };

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.results)) {
      return { results: [] };
    }

    return {
      model: typeof parsed.model === "string" ? parsed.model : undefined,
      results: parsed.results,
    };
  } catch {
    return { results: [] };
  }
};

export const saveVideoToScriptState = (state: VideoToScriptPersistedState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("视频转剧本结果保存失败", error);
  }
};

export const clearVideoToScriptState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("视频转剧本结果清除失败", error);
  }
};
