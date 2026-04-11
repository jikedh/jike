/**
 * 图片下载 IPC Handlers
 * 封装主进程的图片下载功能，供渲染进程调用
 */

import { ipcMain } from "electron";
import {
  downloadImageAsBuffer,
  downloadImageAsBase64,
  downloadImageToFile,
} from "../../utils/downloadImage";

/**
 * 注册图片下载相关的 IPC 通道
 */
export function registerDownloadHandlers(): void {
  // 下载图片作为 Buffer（返回 Uint8Array 给渲染进程）
  ipcMain.handle("download:imageAsBuffer", async (_, url: string) => {
    try {
      const buffer = await downloadImageAsBuffer(url);
      // 将 Buffer 转换为 Uint8Array 以便通过 IPC 传输
      return {
        success: true,
        data: new Uint8Array(buffer),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 下载图片作为 Base64
  ipcMain.handle("download:imageAsBase64", async (_, url: string) => {
    try {
      const result = await downloadImageAsBase64(url);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 下载图片保存到指定文件路径
  ipcMain.handle(
    "download:imageToFile",
    async (_, url: string, filePath: string) => {
      try {
        const savedPath = await downloadImageToFile(url, filePath);
        return {
          success: true,
          data: { path: savedPath },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  );
}
