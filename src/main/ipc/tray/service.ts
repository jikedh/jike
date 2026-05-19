import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import { join } from "path";

// For tray icon, we need a proper file path that works in both dev and prod
function getTrayIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "resources/icon.png");
  }
  return join(app.getAppPath(), "resources/icon.png");
}

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  if (mainWindow) return mainWindow;
  return BrowserWindow.getAllWindows()[0] || null;
}

function buildContextMenu(): Menu {
  const win = getMainWindow();
  const isVisible = win && !win.isDestroyed() && win.isVisible();

  return Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) {
          w.show();
          w.focus();
        }
      },
      visible: !isVisible,
    },
    {
      label: "隐藏主窗口",
      click: () => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) {
          w.hide();
        }
      },
      visible: !!isVisible,
    },
    { type: "separator" },
    {
      label: "退出应用",
      click: () => {
        // Prevent the quit triggered by window-all-closed from
        // hiding the tray prematurely. Force quit.
        app.exit(0);
      },
    },
  ]);
}

export function createTray(): Tray {
  // Create tray icon — use icon directly for 16x16 / 32x32 tray area.
  const iconPath = getTrayIconPath();
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? iconPath : image);
  tray.setToolTip("即刻");

  const contextMenu = buildContextMenu();
  tray.setContextMenu(contextMenu);

  // Single click: toggle window visibility.
  tray.on("click", () => {
    const w = getMainWindow();
    if (!w || w.isDestroyed()) return;
    if (w.isVisible()) {
      w.hide();
    } else {
      w.show();
      w.focus();
    }
  });

  // Rebuild menu when window visibility changes so the two
  // opposite options ("show" / "hide") stay in sync.
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.on("show", () => tray && tray.setContextMenu(buildContextMenu()));
    mainWindow.on("hide", () => tray && tray.setContextMenu(buildContextMenu()));
  }

  return tray;
}

export function isTrayActive(): boolean {
  return tray !== null;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * Set the main window reference so the tray can toggle it.
 * Called from the main process after createWindow().
 */
export function setTrayMainWindow(win: BrowserWindow): void {
  mainWindow = win;
  if (tray) {
    tray.setContextMenu(buildContextMenu());
    win.on("show", () => tray && tray.setContextMenu(buildContextMenu()));
    win.on("hide", () => tray && tray.setContextMenu(buildContextMenu()));
  }
}
