/**
 * 构建 Midjourney 最终提交的 prompt
 * 格式：参考图URL + 用户输入Prompt + --iw 值 + --sref 风格URL + --sw 值
 * 规则：
 * - 多 URL 使用空格拼接
 * - 缺失项跳过，不保留占位
 */
export const buildMidjourneyPrompt = ({
  prompt,
  referenceUrls,
  styleUrls,
  iw,
  sw,
}: {
  prompt?: string;
  referenceUrls?: string[];
  styleUrls?: string[];
  iw?: number;
  sw?: number;
}) => {
  const normalizedPrompt = (prompt ?? "").trim();
  const normalizedReferenceUrls = (referenceUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean);
  const normalizedStyleUrls = (styleUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean);

  const segments: string[] = [];

  if (normalizedReferenceUrls.length > 0) {
    segments.push(normalizedReferenceUrls.join(" "));
  }

  if (normalizedPrompt) {
    segments.push(normalizedPrompt);
  }

  if (
    normalizedReferenceUrls.length > 0 &&
    typeof iw === "number" &&
    !Number.isNaN(iw)
  ) {
    segments.push(`--iw ${iw}`);
  }

  if (normalizedStyleUrls.length > 0) {
    segments.push(`--sref ${normalizedStyleUrls.join(" ")}`);
  }

  if (
    normalizedStyleUrls.length > 0 &&
    typeof sw === "number" &&
    !Number.isNaN(sw)
  ) {
    segments.push(`--sw ${sw}`);
  }

  return segments.join(" ").trim();
};
