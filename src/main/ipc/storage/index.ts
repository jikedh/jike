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

const MEDIA_FOLDERS = [
  "image",
  "generate_image",
  "video",
  "generate_video",
  "audio",
];

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

const buildCoverFallback = (
  basePath: string,
  projectName: string,
  canvasData?: any,
  metaData?: any,
) => {
  const projectDir = join(basePath, projectName);
  const coverFile = ["png", "jpeg", "jpg", "webp", "gif"].find((extension) =>
    existsSync(join(projectDir, `cover.${extension}`)),
  );

  const coverLocalPath =
    canvasData?.coverLocalPath ||
    metaData?.coverLocalPath ||
    (coverFile ? `${projectName}/cover.${coverFile}` : undefined);

  return {
    coverUrl: canvasData?.coverUrl || metaData?.coverUrl,
    coverLocalPath,
  };
};

const mergeProjectCoverMeta = (
  basePath: string,
  projectName: string,
  data: any,
) => {
  const canvasPath = join(basePath, projectName, CANVAS_FILE);
  const metaPath = join(basePath, projectName, PROJECT_META_FILE);
  const existingCanvas = safeReadJson(canvasPath);
  const existingMeta = safeReadJson(metaPath);
  const index = readIndex(basePath);
  const indexedMeta = index.projects?.[projectName];

  const fallback = buildCoverFallback(
    basePath,
    projectName,
    existingCanvas,
    existingMeta || indexedMeta,
  );

  return {
    ...data,
    coverUrl: data?.coverUrl || fallback.coverUrl,
    coverLocalPath: data?.coverLocalPath || fallback.coverLocalPath,
  };
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
        (key === "relativePath" ||
          key === "localPath" ||
          key === "coverLocalPath") &&
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

      next[key] = rewriteRelativePathRecursively(
        item,
        oldProjectName,
        newProjectName,
      );
    }

    return next;
  }

  return value;
};

const copyDirectoryRecursive = (srcDir: string, destDir: string) => {
  mkdirSync(destDir, { recursive: true });

  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
};

const getUniqueProjectName = (basePath: string, preferredName: string) => {
  const index = readIndex(basePath);
  const normalizedName = preferredName.trim() || "导入项目";

  if (
    !existsSync(join(basePath, normalizedName)) &&
    !index.projects?.[normalizedName]
  ) {
    return normalizedName;
  }

  let counter = 1;
  while (true) {
    const candidate = `${normalizedName} (${counter})`;
    if (
      !existsSync(join(basePath, candidate)) &&
      !index.projects?.[candidate]
    ) {
      return candidate;
    }
    counter += 1;
  }
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
      const projectEntries = Object.entries(index.projects || {});
      let indexChanged = false;

      for (const [projectName] of projectEntries) {
        const projectDir = join(basePath, projectName);
        if (!existsSync(projectDir)) {
          delete index.projects[projectName];
          indexChanged = true;
        }
      }

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
          const canvas = safeReadJson(canvasPath);
          const alreadyInIndex = (index.projects || {})[entry.name];
          const coverFallback = buildCoverFallback(
            basePath,
            entry.name,
            canvas,
            meta || alreadyInIndex,
          );

          if (!alreadyInIndex) {
            const projectMeta = {
              ...(meta || {}),
              name: entry.name,
              createdAt: meta?.createdAt || canvas?.savedAt || Date.now(),
              updatedAt: meta?.updatedAt || canvas?.savedAt || Date.now(),
              ...coverFallback,
            };
            diskProjects.push(projectMeta);

            index.projects[entry.name] = projectMeta;
          } else if (
            (!alreadyInIndex.coverUrl && coverFallback.coverUrl) ||
            (!alreadyInIndex.coverLocalPath && coverFallback.coverLocalPath)
          ) {
            index.projects[entry.name] = {
              ...alreadyInIndex,
              coverUrl: alreadyInIndex.coverUrl || coverFallback.coverUrl,
              coverLocalPath:
                alreadyInIndex.coverLocalPath || coverFallback.coverLocalPath,
            };
            indexChanged = true;
          }
        }

        if (diskProjects.length > 0 || indexChanged) {
          writeIndex(basePath, index);
        }
      } catch (e) {
        console.error("[storage:listProjects] scan disk error:", e);
      }

      const latestProjects = Object.values(index.projects || {}).sort(
        (a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0),
      );

      const allProjects = [...latestProjects, ...diskProjects].reduce(
        (acc: any[], p: any) => {
          if (!acc.find((x) => x.name === p.name)) {
            acc.push(p);
          }
          return acc;
        },
        [],
      );

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

        const dataWithCover = mergeProjectCoverMeta(
          basePath,
          projectName,
          data,
        );
        const metaPatch = {
          coverUrl: dataWithCover.coverUrl,
          coverLocalPath: dataWithCover.coverLocalPath,
        };

        const canvasPath = join(basePath, projectName, CANVAS_FILE);
        safeWriteJson(canvasPath, dataWithCover);

        updateProjectUpdatedAt(basePath, projectName);
        const index = readIndex(basePath);
        if (index.projects[projectName]) {
          index.projects[projectName] = {
            ...index.projects[projectName],
            ...metaPatch,
            updatedAt: Date.now(),
          };
          writeIndex(basePath, index);
        }

        const metaPath = join(basePath, projectName, PROJECT_META_FILE);
        const meta = safeReadJson(metaPath);
        if (meta) {
          safeWriteJson(metaPath, {
            ...meta,
            ...metaPatch,
            updatedAt: Date.now(),
          });
        }

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
          return {
            success: false,
            error: "Missing basePath or projectName",
            data: null,
          };
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
    async (
      _,
      basePath: string,
      oldProjectName: string,
      newProjectName: string,
    ) => {
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
          return {
            success: false,
            error: "Source project directory not found",
          };
        }

        renameSync(oldDir, newDir);

        const canvasPath = join(newDir, CANVAS_FILE);
        const canvasData = safeReadJson(canvasPath);
        if (canvasData) {
          const updated = rewriteRelativePathRecursively(
            canvasData,
            oldProjectName,
            newProjectName,
          );
          safeWriteJson(canvasPath, updated);
        }

        const metaPath = join(newDir, PROJECT_META_FILE);
        const oldMeta =
          safeReadJson(metaPath) || index.projects[oldProjectName];
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
    async (
      _,
      basePath: string,
      srcProjectName: string,
      destProjectName: string,
    ) => {
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

        copyDirectoryRecursive(srcDir, destDir);

        const canvasPath = join(destDir, CANVAS_FILE);
        const canvasData = safeReadJson(canvasPath);
        if (canvasData) {
          const updated = rewriteRelativePathRecursively(
            canvasData,
            srcProjectName,
            destProjectName,
          );
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
    "storage:exportProject",
    async (_, basePath: string, projectName: string) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName" };
        }

        const projectDir = join(basePath, projectName);
        if (!existsSync(projectDir)) {
          return { success: false, error: "Project directory not found" };
        }

        const result = await dialog.showOpenDialog({
          properties: ["openDirectory", "createDirectory"],
          title: "选择导出位置",
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        const exportBasePath = result.filePaths[0];
        const exportProjectName = getUniqueProjectName(
          exportBasePath,
          projectName,
        );
        const exportProjectDir = join(exportBasePath, exportProjectName);

        copyDirectoryRecursive(projectDir, exportProjectDir);

        return {
          success: true,
          path: exportProjectDir,
          projectName: exportProjectName,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("storage:importProject", async (_, basePath: string) => {
    try {
      if (!basePath) {
        return { success: false, error: "Missing basePath" };
      }

      if (!existsSync(basePath)) {
        mkdirSync(basePath, { recursive: true });
      }

      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "选择要导入的项目文件夹",
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const srcDir = result.filePaths[0];
      const srcProjectFolderName = basename(srcDir);
      const srcMetaPath = join(srcDir, PROJECT_META_FILE);
      const srcCanvasPath = join(srcDir, CANVAS_FILE);

      if (!existsSync(srcMetaPath) && !existsSync(srcCanvasPath)) {
        return {
          success: false,
          error:
            "所选文件夹不是有效的项目目录，缺少 project.json 或 canvas.json",
        };
      }

      const importedProjectName = getUniqueProjectName(
        basePath,
        srcProjectFolderName,
      );
      const destDir = join(basePath, importedProjectName);

      copyDirectoryRecursive(srcDir, destDir);

      const now = Date.now();
      const canvasPath = join(destDir, CANVAS_FILE);
      const canvasData = safeReadJson(canvasPath);
      const metaPath = join(destDir, PROJECT_META_FILE);
      const sourceMeta = safeReadJson(metaPath) || {};

      if (canvasData) {
        const updatedCanvas = rewriteRelativePathRecursively(
          canvasData,
          srcProjectFolderName,
          importedProjectName,
        );
        const updatedMeta = rewriteRelativePathRecursively(
          sourceMeta,
          srcProjectFolderName,
          importedProjectName,
        );
        const coverFallback = buildCoverFallback(
          basePath,
          importedProjectName,
          updatedCanvas,
          updatedMeta,
        );
        updatedCanvas.projectName = importedProjectName;
        updatedCanvas.savedAt = now;
        updatedCanvas.coverUrl = updatedCanvas.coverUrl || coverFallback.coverUrl;
        updatedCanvas.coverLocalPath =
          updatedCanvas.coverLocalPath || coverFallback.coverLocalPath;
        safeWriteJson(canvasPath, updatedCanvas);
      }

      const updatedSourceMeta = rewriteRelativePathRecursively(
        sourceMeta,
        srcProjectFolderName,
        importedProjectName,
      );
      const importedCanvasData = safeReadJson(canvasPath);
      const coverFallback = buildCoverFallback(
        basePath,
        importedProjectName,
        importedCanvasData,
        updatedSourceMeta,
      );
      const importedMeta = {
        ...updatedSourceMeta,
        name: importedProjectName,
        createdAt: updatedSourceMeta.createdAt || now,
        updatedAt: now,
        coverUrl: updatedSourceMeta.coverUrl || coverFallback.coverUrl,
        coverLocalPath:
          updatedSourceMeta.coverLocalPath || coverFallback.coverLocalPath,
      };
      safeWriteJson(metaPath, importedMeta);

      const index = readIndex(basePath);
      index.projects[importedProjectName] = importedMeta;
      writeIndex(basePath, index);

      return {
        success: true,
        projectName: importedProjectName,
        path: destDir,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

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
