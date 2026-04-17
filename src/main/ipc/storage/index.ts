import { app, dialog, ipcMain } from "electron";
import Store from "electron-store";
import { join } from "path";

const STORAGE_INDEX_NAME = "jike-storage-index";
const STORAGE_VERSION = 1;
const PROJECT_STORE_PREFIX = "jike-project-";
const CANVAS_KEY = "canvas";
const MEDIA_DATA_PREFIX = "media-data:";
const MEDIA_META_PREFIX = "media-meta:";

const createIndexStore = (basePath: string) => {
  return new Store<{
    version: number;
    projects: Record<string, { name: string; createdAt: number; updatedAt: number }>;
  }>({
    name: STORAGE_INDEX_NAME,
    cwd: basePath,
    clearInvalidConfig: true,
    accessPropertiesByDotNotation: false,
    defaults: {
      version: STORAGE_VERSION,
      projects: {},
    },
  });
};

const encodeProjectName = (projectName: string) => {
  return Buffer.from(projectName, "utf-8").toString("base64url");
};

const createProjectStore = (basePath: string, projectName: string) => {
  return new Store<Record<string, any>>({
    name: `${PROJECT_STORE_PREFIX}${encodeProjectName(projectName)}`,
    cwd: basePath,
    clearInvalidConfig: true,
    accessPropertiesByDotNotation: false,
    defaults: {},
  });
};

const normalizeRelativePath = (relativePath: string) => {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
};

const parseRelativePath = (relativePath: string) => {
  const normalized = normalizeRelativePath(relativePath);
  const parts = normalized.split("/").filter(Boolean);
  const projectName = parts[0] || "";

  if (parts.length < 2) {
    return {
      normalized,
      projectName,
      mediaType: "unknown",
      fileName: "",
    };
  }

  if (parts.length === 2) {
    return {
      normalized,
      projectName,
      mediaType: "cover",
      fileName: parts[1],
    };
  }

  return {
    normalized,
    projectName,
    mediaType: parts[1],
    fileName: parts.slice(2).join("/"),
  };
};

const upsertProjectMeta = (basePath: string, projectName: string) => {
  const indexStore = createIndexStore(basePath);
  const projects = indexStore.get("projects") || {};
  const now = Date.now();

  const existing = projects[projectName];
  const next = existing
    ? {
      ...existing,
      updatedAt: now,
    }
    : {
      name: projectName,
      createdAt: now,
      updatedAt: now,
    };

  indexStore.set("projects", {
    ...projects,
    [projectName]: next,
  });

  return next;
};

const updateProjectUpdatedAt = (basePath: string, projectName: string) => {
  const indexStore = createIndexStore(basePath);
  const projects = indexStore.get("projects") || {};
  const existing = projects[projectName];

  if (!existing) {
    upsertProjectMeta(basePath, projectName);
    return;
  }

  indexStore.set("projects", {
    ...projects,
    [projectName]: {
      ...existing,
      updatedAt: Date.now(),
    },
  });
};

const getProjectMetaList = (basePath: string) => {
  const indexStore = createIndexStore(basePath);
  const projects = indexStore.get("projects") || {};
  return Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);
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

/**
 * Storage IPC Handlers
 * 使用 electron-store 管理本地持久化（项目索引 + 画布数据 + 媒体二进制）
 */
export function registerStorageHandlers(): void {
  // 选择目录
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

  // 确保项目存在（仅写入索引）
  ipcMain.handle(
    "storage:ensureProject",
    async (_, basePath: string, projectName: string) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName" };
        }

        const project = upsertProjectMeta(basePath, projectName);
        const projectStore = createProjectStore(basePath, projectName);
        projectStore.set("meta", project);

        return { success: true, project };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 列出项目
  ipcMain.handle("storage:listProjects", async (_, basePath: string) => {
    try {
      if (!basePath) {
        return { success: false, error: "Missing basePath", projects: [] };
      }

      const projects = getProjectMetaList(basePath);
      return { success: true, projects };
    } catch (error: any) {
      return { success: false, error: error.message, projects: [] };
    }
  });

  // 保存画布 JSON
  ipcMain.handle(
    "storage:saveCanvas",
    async (_, basePath: string, projectName: string, data: any) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName" };
        }

        upsertProjectMeta(basePath, projectName);
        const projectStore = createProjectStore(basePath, projectName);
        projectStore.set(CANVAS_KEY, data);
        updateProjectUpdatedAt(basePath, projectName);

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 读取画布 JSON
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

        const projectStore = createProjectStore(basePath, projectName);
        const canvas = projectStore.get(CANVAS_KEY);

        if (!canvas) {
          return { success: false, error: "Canvas not found", data: null };
        }

        return { success: true, data: canvas };
      } catch (error: any) {
        return { success: false, error: error.message, data: null };
      }
    },
  );

  // 保存媒体（二进制 -> base64）
  ipcMain.handle(
    "storage:saveMedia",
    async (_, basePath: string, relativePath: string, buffer: ArrayBuffer) => {
      try {
        const { normalized, projectName, mediaType, fileName } = parseRelativePath(relativePath);

        if (!basePath || !projectName || !fileName) {
          return { success: false, error: "Invalid basePath or relativePath" };
        }

        upsertProjectMeta(basePath, projectName);

        const content = Buffer.from(buffer);
        const base64 = content.toString("base64");
        const now = Date.now();

        const projectStore = createProjectStore(basePath, projectName);
        projectStore.set(`${MEDIA_DATA_PREFIX}${normalized}`, base64);
        projectStore.set(`${MEDIA_META_PREFIX}${normalized}`, {
          name: fileName,
          path: normalized,
          relativePath: normalized,
          mediaType,
          isDirectory: false,
          size: content.byteLength,
          modifiedAt: now,
        });

        updateProjectUpdatedAt(basePath, projectName);
        return { success: true, path: normalized };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 读取媒体（base64 -> Buffer）
  ipcMain.handle(
    "storage:readMedia",
    async (_, basePath: string, relativePath: string) => {
      try {
        const { normalized, projectName } = parseRelativePath(relativePath);

        if (!basePath || !projectName) {
          return { success: false, error: "Invalid basePath or relativePath", data: null };
        }

        const projectStore = createProjectStore(basePath, projectName);
        const base64 = projectStore.get(`${MEDIA_DATA_PREFIX}${normalized}`);

        if (typeof base64 !== "string") {
          return { success: false, error: "Media not found", data: null };
        }

        const content = Buffer.from(base64, "base64");
        return { success: true, data: content };
      } catch (error: any) {
        return { success: false, error: error.message, data: null };
      }
    },
  );

  // 列出某个项目下某类媒体
  ipcMain.handle(
    "storage:listMedia",
    async (_, basePath: string, projectName: string, mediaType: string) => {
      try {
        if (!basePath || !projectName || !mediaType) {
          return { success: false, error: "Missing params", files: [] };
        }

        const projectStore = createProjectStore(basePath, projectName);
        const allEntries = Object.entries(projectStore.store || {});

        const files = allEntries
          .filter(([key]) => key.startsWith(MEDIA_META_PREFIX))
          .map(([, value]) => value as any)
          .filter((item) => item?.mediaType === mediaType)
          .sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));

        return { success: true, files };
      } catch (error: any) {
        return { success: false, error: error.message, files: [] };
      }
    },
  );

  // 删除媒体
  ipcMain.handle(
    "storage:deleteMedia",
    async (_, basePath: string, relativePath: string) => {
      try {
        const { normalized, projectName } = parseRelativePath(relativePath);

        if (!basePath || !projectName) {
          return { success: false, error: "Invalid basePath or relativePath" };
        }

        const projectStore = createProjectStore(basePath, projectName);
        projectStore.delete(`${MEDIA_DATA_PREFIX}${normalized}`);
        projectStore.delete(`${MEDIA_META_PREFIX}${normalized}`);

        updateProjectUpdatedAt(basePath, projectName);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 下载媒体并存入 store
  ipcMain.handle(
    "storage:downloadMedia",
    async (_, basePath: string, url: string, relativePath: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        const { normalized, projectName, mediaType, fileName } = parseRelativePath(relativePath);
        if (!basePath || !projectName || !fileName) {
          return { success: false, error: "Invalid basePath or relativePath" };
        }

        upsertProjectMeta(basePath, projectName);

        const content = Buffer.from(arrayBuffer);
        const base64 = content.toString("base64");
        const now = Date.now();

        const projectStore = createProjectStore(basePath, projectName);
        projectStore.set(`${MEDIA_DATA_PREFIX}${normalized}`, base64);
        projectStore.set(`${MEDIA_META_PREFIX}${normalized}`, {
          name: fileName,
          path: normalized,
          relativePath: normalized,
          mediaType,
          isDirectory: false,
          size: content.byteLength,
          modifiedAt: now,
        });

        updateProjectUpdatedAt(basePath, projectName);
        return { success: true, path: normalized };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 重命名项目（迁移旧项目 store 到新项目 store）
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

        const indexStore = createIndexStore(basePath);
        const projects = indexStore.get("projects") || {};

        if (!projects[oldProjectName]) {
          return { success: false, error: "Source project does not exist" };
        }

        if (projects[newProjectName]) {
          return { success: false, error: "Target project already exists" };
        }

        const oldStore = createProjectStore(basePath, oldProjectName);
        const oldData = oldStore.store || {};

        const newStore = createProjectStore(basePath, newProjectName);
        const nextData: Record<string, any> = {};
        const oldPrefix = `${oldProjectName}/`;
        const newPrefix = `${newProjectName}/`;

        for (const [key, value] of Object.entries(oldData)) {
          if (key === CANVAS_KEY) {
            nextData[key] = rewriteRelativePathRecursively(
              value,
              oldProjectName,
              newProjectName,
            );
            continue;
          }

          if (key.startsWith(MEDIA_DATA_PREFIX) || key.startsWith(MEDIA_META_PREFIX)) {
            const prefix = key.startsWith(MEDIA_DATA_PREFIX)
              ? MEDIA_DATA_PREFIX
              : MEDIA_META_PREFIX;
            const relativePath = key.slice(prefix.length);
            const nextRelativePath = relativePath.startsWith(oldPrefix)
              ? `${newPrefix}${relativePath.slice(oldPrefix.length)}`
              : relativePath;

            if (prefix === MEDIA_META_PREFIX && value && typeof value === "object") {
              nextData[`${prefix}${nextRelativePath}`] = {
                ...(value as any),
                path: nextRelativePath,
                relativePath: nextRelativePath,
              };
            } else {
              nextData[`${prefix}${nextRelativePath}`] = value;
            }
            continue;
          }

          nextData[key] = value;
        }

        newStore.store = nextData;
        oldStore.clear();

        const oldMeta = projects[oldProjectName];
        const { [oldProjectName]: _deleted, ...rest } = projects;
        void _deleted;

        indexStore.set("projects", {
          ...rest,
          [newProjectName]: {
            ...oldMeta,
            name: newProjectName,
            updatedAt: Date.now(),
          },
        });

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 删除项目（删除索引 + 清空项目 store）
  ipcMain.handle(
    "storage:deleteProject",
    async (_, basePath: string, projectName: string) => {
      try {
        if (!basePath || !projectName) {
          return { success: false, error: "Missing basePath or projectName" };
        }

        const indexStore = createIndexStore(basePath);
        const projects = indexStore.get("projects") || {};

        if (projects[projectName]) {
          const { [projectName]: _deleted, ...rest } = projects;
          void _deleted;
          indexStore.set("projects", rest);
        }

        const projectStore = createProjectStore(basePath, projectName);
        projectStore.clear();

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // 获取默认路径
  ipcMain.handle("storage:getDefaultPath", async () => {
    return join(app.getPath("documents"), "jike-projects");
  });
}
