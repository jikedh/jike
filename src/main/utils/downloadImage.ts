/**
 * 主进程图片下载工具
 * 由于在主进程执行，不受跨域限制，可以下载任意域的图片
 */

import { net } from "electron";

/**
 * 下载跨域图片并返回 Buffer
 * @param url 图片 URL
 * @returns Promise<Buffer> 图片二进制数据
 */
export async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);

    const chunks: Buffer[] = [];

    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        return;
      }

      response.on("data", (chunk) => {
        chunks.push(chunk);
      });

      response.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      response.on("error", (err) => {
        reject(new Error(`下载图片失败: ${err.message}`));
      });
    });

    request.on("error", (err) => {
      reject(new Error(`请求图片失败: ${err.message}`));
    });

    request.end();
  });
}

/**
 * 下载跨域图片并转换为 Base64
 * @param url 图片 URL
 * @returns Promise<string> Base64 字符串（带 data:image/xxx;base64, 前缀）
 */
export async function downloadImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const buffer = await downloadImageAsBuffer(url);

  // 从 URL 或 Content-Type 头获取 MIME 类型
  let mimeType = "image/jpeg";
  const pngMatch = url.match(/\.png(?:\?|$)/i);
  const webpMatch = url.match(/\.webp(?:\?|$)/i);
  const gifMatch = url.match(/\.gif(?:\?|$)/i);

  if (pngMatch) mimeType = "image/png";
  else if (webpMatch) mimeType = "image/webp";
  else if (gifMatch) mimeType = "image/gif";

  const base64 = buffer.toString("base64");
  return {
    base64: `data:${mimeType};base64,${base64}`,
    mimeType,
  };
}

/**
 * 下载跨域图片并保存到本地临时文件
 * @param url 图片 URL
 * @param filePath 保存路径
 * @returns Promise<string> 保存后的文件路径
 */
export async function downloadImageToFile(
  url: string,
  filePath: string,
): Promise<string> {
  const buffer = await downloadImageAsBuffer(url);
  const fs = await import("fs/promises");
  await fs.writeFile(filePath, buffer);
  return filePath;
}
