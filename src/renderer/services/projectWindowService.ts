import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface OpenCanvasProjectWindowResult {
  openedExisting: boolean;
}

const CANVAS_WINDOW_WIDTH = 1440;
const CANVAS_WINDOW_HEIGHT = 900;
const CANVAS_WINDOW_MIN_WIDTH = 1024;
const CANVAS_WINDOW_MIN_HEIGHT = 720;

function getCanvasWindowLabel(projectId: string): string {
  return `canvas-${projectId.replace(/[^a-zA-Z0-9-/:_]/g, "-")}`;
}

function getCanvasWindowUrl(projectId: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `/canvas/${encodeURIComponent(projectId)}`;
  return url.toString();
}

export async function openCanvasProjectWindow(
  projectId: string,
  projectName?: string,
): Promise<OpenCanvasProjectWindowResult> {
  const label = getCanvasWindowLabel(projectId);
  const existingWindow = await WebviewWindow.getByLabel(label);

  if (existingWindow) {
    await existingWindow.show();
    await existingWindow.unminimize();
    await existingWindow.setFocus();
    return { openedExisting: true };
  }

  const canvasWindow = new WebviewWindow(label, {
    url: getCanvasWindowUrl(projectId),
    title: projectName ? `${projectName} - 画布` : "画布项目",
    width: CANVAS_WINDOW_WIDTH,
    height: CANVAS_WINDOW_HEIGHT,
    minWidth: CANVAS_WINDOW_MIN_WIDTH,
    minHeight: CANVAS_WINDOW_MIN_HEIGHT,
    center: true,
    resizable: true,
    focus: true,
  });

  await new Promise<void>((resolve, reject) => {
    void canvasWindow.once("tauri://created", () => {
      void canvasWindow.setFocus();
      resolve();
    });

    void canvasWindow.once("tauri://error", (event) => {
      reject(event.payload);
    });
  });

  return { openedExisting: false };
}
