import { app } from "electron";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { dirname, join, normalize } from "path";
import { DEFAULT_PROJECTS_DIR_NAME } from "../constants/app";

const ensureDirectory = (targetPath: string) => {
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true });
  }
};

const ensureParentDirectory = (targetPath: string) => {
  ensureDirectory(dirname(targetPath));
};

const copyDirectoryRecursively = (sourceDir: string, targetDir: string) => {
  ensureDirectory(targetDir);

  const entries = readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursively(sourcePath, targetPath);
      continue;
    }

    const content = readFileSync(sourcePath);
    writeFileSync(targetPath, content);
  }
};

/**
 * 主进程存储服务。
 * 将 IPC 中的文件系统细节下沉，减少 handler 文件体积，方便后续扩展。
 */
export const storageService = {
  ensureProjectDir: (basePath: string, projectName: string) => {
    const projectDir = normalize(join(basePath, projectName));
    const audioDir = join(projectDir, "audio");

    ensureDirectory(projectDir);
    ensureDirectory(audioDir);

    return projectDir;
  },

  writeJson: (filePath: string, data: any) => {
    const normalizedPath = normalize(filePath);
    ensureParentDirectory(normalizedPath);
    writeFileSync(normalizedPath, JSON.stringify(data, null, 2), "utf-8");
  },

  readJson: (filePath: string) => {
    const normalizedPath = normalize(filePath);

    if (!existsSync(normalizedPath)) {
      return null;
    }

    const content = readFileSync(normalizedPath, "utf-8");
    return JSON.parse(content);
  },

  writeFile: (filePath: string, buffer: ArrayBuffer) => {
    const normalizedPath = normalize(filePath);
    ensureParentDirectory(normalizedPath);
    writeFileSync(normalizedPath, Buffer.from(buffer));
  },

  readFile: (filePath: string) => {
    const normalizedPath = normalize(filePath);

    if (!existsSync(normalizedPath)) {
      return null;
    }

    return readFileSync(normalizedPath);
  },

  deleteFile: (filePath: string) => {
    const normalizedPath = normalize(filePath);

    if (existsSync(normalizedPath)) {
      unlinkSync(normalizedPath);
    }
  },

  deleteFolder: (folderPath: string) => {
    const normalizedPath = normalize(folderPath);

    if (existsSync(normalizedPath)) {
      rmSync(normalizedPath, { recursive: true, force: true });
    }
  },

  fileExists: (filePath: string) => {
    return existsSync(normalize(filePath));
  },

  listFiles: (dirPath: string) => {
    const normalizedPath = normalize(dirPath);

    if (!existsSync(normalizedPath)) {
      return [];
    }

    return readdirSync(normalizedPath).map((name) => {
      const fullPath = join(normalizedPath, name);
      const stats = statSync(fullPath);

      return {
        name,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtimeMs,
      };
    });
  },

  downloadFile: async (url: string, destPath: string) => {
    const normalizedPath = normalize(destPath);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    ensureParentDirectory(normalizedPath);
    writeFileSync(normalizedPath, Buffer.from(arrayBuffer));

    return normalizedPath;
  },

  renameDirectory: (oldPath: string, newPath: string) => {
    const normalizedOldPath = normalize(oldPath);
    const normalizedNewPath = normalize(newPath);

    if (!existsSync(normalizedOldPath)) {
      throw new Error("Source directory does not exist");
    }

    if (existsSync(normalizedNewPath)) {
      throw new Error("Target directory already exists");
    }

    ensureDirectory(dirname(normalizedNewPath));
    renameSync(normalizedOldPath, normalizedNewPath);
  },

  migrateProjects: (oldPath: string, newPath: string) => {
    const normalizedOldPath = normalize(oldPath);
    const normalizedNewPath = normalize(newPath);

    if (!existsSync(normalizedOldPath)) {
      return { migratedCount: 0, skipped: true };
    }

    ensureDirectory(normalizedNewPath);

    const entries = readdirSync(normalizedOldPath, { withFileTypes: true });
    let migratedCount = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const projectDir = join(normalizedOldPath, entry.name);
      const canvasFile = join(projectDir, "canvas.json");

      if (!existsSync(canvasFile)) {
        continue;
      }

      const targetDir = join(normalizedNewPath, entry.name);
      if (existsSync(targetDir)) {
        continue;
      }

      copyDirectoryRecursively(projectDir, targetDir);
      migratedCount++;
    }

    return { migratedCount, skipped: false };
  },

  getDefaultPath: () => {
    return join(app.getPath("documents"), DEFAULT_PROJECTS_DIR_NAME);
  },
};
