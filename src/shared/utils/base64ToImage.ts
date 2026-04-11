import { uploadFileToOSS } from "service/oss";

/**
 * 判断 Base64 字符串是否为 data URI 格式
 * @param base64 Base64 字符串
 * @returns boolean
 */
export function isDataURI(base64: string): boolean {
  return /^data:image\/\w+;base64,/.test(base64);
}

/**
 * 将 Base64 字符串转换为 File 对象
 * @param base64 Base64 字符串（支持带或不带 data URI 前缀）
 * @param filename 文件名（不含扩展名），默认使用时间戳
 * @returns File 对象
 */
export function base64ToFile(base64: string, filename = ""): File {
  // 提取 MIME 类型和实际数据
  let mimeType = "image/png";
  let data = base64;

  const dataUriMatch = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1];
    data = dataUriMatch[2];
  }

  // 将 Base64 转换为 Uint8Array
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 生成文件名
  const ext = mimeType.split("/")[1] || "png";
  const name = filename || `${Date.now()}`;

  // 创建 File 对象
  return new File([bytes], `${name}.${ext}`, { type: mimeType });
}

/**
 * 将 Base64 图片上传到 OSS
 * @param base64 Base64 字符串（支持带或不带 data URI 前缀）
 * @param filename 文件名（不含扩展名），默认使用时间戳
 * @returns Promise<{ url: string; name: string }> OSS 返回的 URL 和原始文件名
 */
export async function uploadBase64ToOSS(
  base64: string,
  filename?: string,
): Promise<{ url: string; name: string }> {
  const file = base64ToFile(base64, filename);
  return uploadFileToOSS(file);
}
