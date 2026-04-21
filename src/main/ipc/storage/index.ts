import { app, dialog, ipcMain } from "electron";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
  renameSync,
  copyFileSync,
} from "fs";
import { join, dirname, basename } from "path";

const CANVAS_FILE = "canvas.json";
const PROJECT_META_FILE = "project.json";
const INDEX_FILE = "index.json";

const MEDIA_FOLDERS = ["image", "generate_image", "video", "generate_video", "audio"];

const safeReadJson = (filePath: string): any => {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const safeWriteJson = (filePath: string, data: any): void => {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const readIndex = (basePath: string) => {
  const indexPath = join(basePath, INDEX_FILE);
  return safeReadJson(indexPath) || { version: 1, projects: {} };
};

const writeIndex = (basePath: string, data: any) => {
  const indexPath = join(basePath, INDEX_FILE);
  safeWriteJson(indexPath, data);
};

const upsertProjectMeta = (basePath: string, projectName: string) => {
  const index = readIndex(basePath);
  const now = Date.now();
  const existing = index.projects[projectName];

  const meta = existing
    ? { ...existing, updatedAt: now }
    : { name: projectName, createdAt: now, updatedAt: now };

  index.projects[projectName] = meta;
  writeIndex(basePath, index);

  const projectDir = join(basePath, projectName);
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  for (const folder of MEDIA_FOLDERS) {
    const folderPath = join(projectDir, folder);
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }
  }

  const metaPath = join(projectDir, PROJECT_META_FILE);
  safeWriteJson(metaPath, meta);

  return meta;
};

const updateProjectUpdatedAt = (basePath: string, projectName: string) => {
  const index = readIndex(basePath);
  if (!index.projects[projectName]) {
    upsertProjectMeta(basePath, projectName);
    return;
  }
  index.projects[projectName].updatedAt = Date.now();
  writeIndex(basePath, index);
};

const rewriteRelativePathRecursively = (
  value: any,
  oldProjectName: string,
  newProjectName: string,
): any => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      rewriteRelativePathRecursively(item, oldProjectName, newProjectName),
    );
  }

  if (value && typeof value === "object") {
    const next: Record<string, any> = {};
    const oldPrefix = `${oldProjectName}/`;
    const newPrefix = `${newProjectName}/`;

    for (const [key, item] of Object.entries(value)) {
      if (
        (key === "relativePath" || key === "localPath") &&
        typeof item === "string" &&
        item.startsWith(oldPrefix)
      ) {
        next[key] = `${newPrefix}${item.slice(oldPrefix.length)}`;
        continue;
      }

      if (key === "projectName" && item === oldProjectName) {
        next[key] = newProjectName;
        continue;
      }

      next[key] = rewriteRelativePathRecursively(item, oldProjectName, newProjectName);
    }

    return next;
  }

  return value;
};

export function registerStorageHandlers(): void {
  ipcMain.handle("storage:selectDirectory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "选择项目存储路径",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(
    "storage:ensureProject",
    async (_, basePath: string, projectName: string) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName" };
        }

        if (!existsSync(basePath)) {
          mkdirSync(basePath, { recursive: true });
        }

        const project = upsertProjectMeta(basePath, projectName);
        return { success: true, project };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("storage:listProjects", async (_, basePath: string) => {
    try {
      if (!basePath || !existsSync(basePath)) {
        return { success: true, projects: [] };
      }

      const index = readIndex(basePath);
      const projects = Object.values(index.projects || {}).sort(
        (a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0),
      );

      const diskProjects: any[] = [];
      try {
        const entries = readdirSync(basePath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const projectDir = join(basePath, entry.name);
          const metaPath = join(projectDir, PROJECT_META_FILE);
          const canvasPath = join(projectDir, CANVAS_FILE);

          if (!existsSync(metaPath) && !existsSync(canvasPath)) continue;

          const meta = safeReadJson(metaPath);
          const alreadyInIndex = (index.projects || {})[entry.name];

          if (!alreadyInIndex) {
            const projectMeta = meta || {
              name: entry.name,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            diskProjects.push(projectMeta);

            index.projects[entry.name] = projectMeta;
          }
        }

        if (diskProjects.length > 0) {
          writeIndex(basePath, index);
        }
      } catch (e) {
        console.error("[storage:listProjects] scan disk error:", e);
      }

      const allProjects = [...projects, ...diskProjects].reduce((acc: any[], p: any) => {
        if (!acc.find((x) => x.name === p.name)) {
          acc.push(p);
        }
        return acc;
      }, []);

      return {
        success: true,
        projects: allProjects.sort(
          (a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0),
        ),
      };
    } catch (error: any) {
      return { success: false, error: error.message, projects: [] };
    }
  });

  ipcMain.handle(
    "storage:saveCanvas",
    async (_, basePath: string, projectName: string, data: any) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName" };
        }

        upsertProjectMeta(basePath, projectName);

        const canvasPath = join(basePath, projectName, CANVAS_FILE);
        safeWriteJson(canvasPath, data);

        updateProjectUpdatedAt(basePath, projectName);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:loadCanvas",
    async (_, basePath: string, projectName: string) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName", data: null };
        }

        const canvasPath = join(basePath, projectName, CANVAS_FILE);
        const canvas = safeReadJson(canvasPath);

        if (!canvas) {
          return { success: false, error: "Canvas not found", data: null };
        }

        return { success: true, data: canvas };
      } catch (error: any) {
        return { success: false, error: error.message, data: null };
      }
    },
  );

  ipcMain.handle(
    "storage:saveMedia",
    async (_, basePath: string, relativePath: string, buffer: ArrayBuffer) => {
      try {
        const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
        const parts = normalized.split("/").filter(Boolean);
        const projectName = parts[0] || "";

        if (!basePath || !projectName || parts.length < 2) {
          return { success: false, error: "Invalid basePath or relativePath" };
        }

        upsertProjectMeta(basePath, projectName);

        const absPath = join(basePath, normalized);
        const absDir = dirname(absPath);
        if (!existsSync(absDir)) {
          mkdirSync(absDir, { recursive: true });
        }

        const content = Buffer.from(buffer);
        writeFileSync(absPath, content);

        updateProjectUpdatedAt(basePath, projectName);
        return { success: true, path: normalized };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:readMedia",
    async (_, basePath: string, relativePath: string) => {
      try {
        const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
        const absPath = join(basePath, normalized);

        if (!existsSync(absPath)) {
          return { success: false, error: "Media not found", data: null };
        }

        const content = readFileSync(absPath);
        return { success: true, data: content };
      } catch (error: any) {
        return { success: false, error: error.message, data: null };
      }
    },
  );

  ipcMain.handle(
    "storage:listMedia",
    async (_, basePath: string, projectName: string, mediaType: string) => {
      try {
        if (!basePath || !projectName || !mediaType) {
          return { success: false, error: "Missing params", files: [] };
        }

        const mediaDir = join(basePath, projectName, mediaType);
        if (!existsSync(mediaDir)) {
          return { success: true, files: [] };
        }

        const files: any[] = [];
        const entries = readdirSync(mediaDir);

        for (const entry of entries) {
          const entryPath = join(mediaDir, entry);
          try {
            const stat = statSync(entryPath);
            if (stat.isFile()) {
              files.push({
                name: entry,
                path: `${projectName}/${mediaType}/${entry}`,
                relativePath: `${projectName}/${mediaType}/${entry}`,
                mediaType,
                isDirectory: false,
                size: stat.size,
                modifiedAt: stat.mtimeMs,
              });
            }
          } catch {
            // skip unreadable files
          }
        }

        files.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
        return { success: true, files };
      } catch (error: any) {
        return { success: false, error: error.message, files: [] };
      }
    },
  );

  ipcMain.handle(
    "storage:deleteMedia",
    async (_, basePath: string, relativePath: string) => {
      try {
        const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
        const parts = normalized.split("/").filter(Boolean);
        const projectName = parts[0] || "";

        if (!basePath || !projectName) {
          return { success: false, error: "Invalid basePath or relativePath" };
        }

        const absPath = join(basePath, normalized);
        if (existsSync(absPath)) {
          unlinkSync(absPath);
        }

        updateProjectUpdatedAt(basePath, projectName);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:downloadMedia",
    async (_, basePath: string, url: string, relativePath: string) => {
      try {
        const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
        const parts = normalized.split("/").filter(Boolean);
        const projectName = parts[0] || "";

        if (!basePath || !projectName || parts.length < 2) {
          return { success: false, error: "Invalid basePath or relativePath" };
        }

        upsertProjectMeta(basePath, projectName);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const content = Buffer.from(arrayBuffer);

        const absPath = join(basePath, normalized);
        const absDir = dirname(absPath);
        if (!existsSync(absDir)) {
          mkdirSync(absDir, { recursive: true });
        }

        writeFileSync(absPath, content);

        updateProjectUpdatedAt(basePath, projectName);
        return { success: true, path: normalized };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:renameProject",
    async (_, basePath: string, oldProjectName: string, newProjectName: string) => {
      try {
        if (!basePath || !oldProjectName || !newProjectName) {
          return { success: false, error: "Missing params" };
        }

        if (oldProjectName === newProjectName) {
          return { success: true };
        }

        const index = readIndex(basePath);
        if (!index.projects[oldProjectName]) {
          return { success: false, error: "Source project does not exist" };
        }
        if (index.projects[newProjectName]) {
          return { success: false, error: "Target project already exists" };
        }

        const oldDir = join(basePath, oldProjectName);
        const newDir = join(basePath, newProjectName);

        if (!existsSync(oldDir)) {
          return { success: false, error: "Source project directory not found" };
        }

        renameSync(oldDir, newDir);

        const canvasPath = join(newDir, CANVAS_FILE);
        const canvasData = safeReadJson(canvasPath);
        if (canvasData) {
          const updated = rewriteRelativePathRecursively(canvasData, oldProjectName, newProjectName);
          safeWriteJson(canvasPath, updated);
        }

        const metaPath = join(newDir, PROJECT_META_FILE);
        const oldMeta = safeReadJson(metaPath) || index.projects[oldProjectName];
        safeWriteJson(metaPath, {
          ...oldMeta,
          name: newProjectName,
          updatedAt: Date.now(),
        });

        const { [oldProjectName]: _deleted, ...rest } = index.projects;
        void _deleted;
        index.projects = {
          ...rest,
          [newProjectName]: {
            ...oldMeta,
            name: newProjectName,
            updatedAt: Date.now(),
          },
        };
        writeIndex(basePath, index);

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:deleteProject",
    async (_, basePath: string, projectName: string) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName" };
        }

        const projectDir = join(basePath, projectName);
        if (existsSync(projectDir)) {
          rmSync(projectDir, { recursive: true, force: true });
        }

        const index = readIndex(basePath);
        if (index.projects[projectName]) {
          const { [projectName]: _deleted, ...rest } = index.projects;
          void _deleted;
          index.projects = rest;
          writeIndex(basePath, index);
        }

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:copyProject",
    async (_, basePath: string, srcProjectName: string, destProjectName: string) => {
      try {
        if (!basePath || !srcProjectName || !destProjectName) {
          return { success: false, error: "Missing params" };
        }

        const srcDir = join(basePath, srcProjectName);
        const destDir = join(basePath, destProjectName);

        if (!existsSync(srcDir)) {
          return { success: false, error: "Source project not found" };
        }
        if (existsSync(destDir)) {
          return { success: false, error: "Target project already exists" };
        }

        mkdirSync(destDir, { recursive: true });

        const entries = readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = join(srcDir, entry.name);
          const destPath = join(destDir, entry.name);

          if (entry.isFile()) {
            copyFileSync(srcPath, destPath);
          } else if (entry.isDirectory()) {
            mkdirSync(destPath, { recursive: true });
            const subEntries = readdirSync(srcPath, { withFileTypes: true });
            for (const subEntry of subEntries) {
              const subSrc = join(srcPath, subEntry.name);
              const subDest = join(destPath, subEntry.name);
              if (subEntry.isFile()) {
                copyFileSync(subSrc, subDest);
              }
            }
          }
        }

        const canvasPath = join(destDir, CANVAS_FILE);
        const canvasData = safeReadJson(canvasPath);
        if (canvasData) {
          const updated = rewriteRelativePathRecursively(canvasData, srcProjectName, destProjectName);
          safeWriteJson(canvasPath, updated);
        }

        const metaPath = join(destDir, PROJECT_META_FILE);
        safeWriteJson(metaPath, {
          name: destProjectName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        upsertProjectMeta(basePath, destProjectName);

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "storage:mediaExists",
    async (_, basePath: string, relativePath: string) => {
      try {
        const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
        const absPath = join(basePath, normalized);
        return existsSync(absPath);
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle("storage:getDefaultPath", async () => {
    return join(app.getPath("documents"), "jike-projects");
  });
}
