import { join } from "path";

/**
 * 主进程应用级常量。
 * 统一收口窗口标题、应用标识和资源路径片段，避免散落在入口文件中。
 */
export const APP_ID = "com.yunyun.jike";
export const WINDOW_TITLE = "即刻";
export const DEFAULT_PROJECTS_DIR_NAME = "jike-projects";

/**
 * 运行时资源目录中的图标文件名。
 */
export const APP_ICON_FILE_NAME = "icon.png";

/**
 * 预加载脚本在打包产物中的相对位置。
 */
export const PACKAGED_PRELOAD_SEGMENTS = ["app.asar", "out", "preload", "index.mjs"];

/**
 * 渲染层入口在打包产物中的相对位置。
 */
export const RENDERER_HTML_SEGMENTS = ["..", "renderer", "index.html"];

/**
 * 生成 icon 绝对路径。
 */
export const joinIconPath = (basePath: string) => {
  return join(basePath, APP_ICON_FILE_NAME);
};
