import { dialog, ipcMain } from "electron";
import { storageService } from "../../services/storageService";

/**
 * Storage IPC Handlers
 * 处理文件系统相关的 IPC 通道
 */
export function registerStorageHandlers(): void {
  // 选择目录
  ipcMain.handle("storage:selectDirectory", async (_, mainWindow) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择项目存储路径",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 确保项目目录存在
  ipcMain.handle(
    "storage:ensureProjectDir",
    async (_, basePath: string, projectName: string) => {
      try {
        const projectDir = storageService.ensureProjectDir(basePath, projectName);
        return { success: true, path: projectDir };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 写入 JSON 文件
  ipcMain.handle(
    "storage:writeJson",
    async (_, filePath: string, data: any) => {
      try {
        storageService.writeJson(filePath, data);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 读取 JSON 文件
  ipcMain.handle("storage:readJson", async (_, filePath: string) => {
    try {
      const data = storageService.readJson(filePath);
      if (data === null) {
        return { success: false, error: "File not found", data: null };
      }
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message, data: null };
    }
  });

  // 写入文件
  ipcMain.handle(
    "storage:writeFile",
    async (_, filePath: string, buffer: ArrayBuffer) => {
      try {
        storageService.writeFile(filePath, buffer);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 读取文件
  ipcMain.handle("storage:readFile", async (_, filePath: string) => {
    try {
      const data = storageService.readFile(filePath);
      if (data === null) {
        return { success: false, error: "File not found", data: null };
      }
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message, data: null };
    }
  });

  // 删除文件
  ipcMain.handle("storage:deleteFile", async (_, filePath: string) => {
    try {
      storageService.deleteFile(filePath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 删除文件夹
  ipcMain.handle("storage:deleteFolder", async (_, folderPath: string) => {
    try {
      storageService.deleteFolder(folderPath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 检查文件是否存在
  ipcMain.handle("storage:fileExists", async (_, filePath: string) => {
    return storageService.fileExists(filePath);
  });

  // 列出目录文件
  ipcMain.handle("storage:listFiles", async (_, dirPath: string) => {
    try {
      const files = storageService.listFiles(dirPath);
      return { success: true, files };
    } catch (error: any) {
      return { success: false, error: error.message, files: [] };
    }
  });

  // 下载文件
  ipcMain.handle(
    "storage:downloadFile",
    async (_, url: string, destPath: string) => {
      try {
        const path = await storageService.downloadFile(url, destPath);
        return { success: true, path };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 重命名目录
  ipcMain.handle(
    "storage:renameDirectory",
    async (_, oldPath: string, newPath: string) => {
      try {
        storageService.renameDirectory(oldPath, newPath);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 迁移项目
  ipcMain.handle(
    "storage:migrateProjects",
    async (_, oldPath: string, newPath: string) => {
      try {
        const result = storageService.migrateProjects(oldPath, newPath);
        if (result.skipped) {
          return {
            success: true,
            message: "Old path does not exist, nothing to migrate",
            migratedCount: 0,
          };
        }

        return { success: true, migratedCount: result.migratedCount };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 获取默认路径
  ipcMain.handle("storage:getDefaultPath", async () => {
    return storageService.getDefaultPath();
  });
}
