import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname, normalize } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { promises as fs } from 'fs'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync, renameSync } from 'fs'
// @ts-ignore
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: '即刻',
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle('storage:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择项目存储路径'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('storage:ensureProjectDir', async (_, basePath: string, projectName: string) => {
    const projectDir = normalize(join(basePath, projectName))
    const audioDir = join(projectDir, 'audio')

    try {
      if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true })
      }
      if (!existsSync(audioDir)) {
        mkdirSync(audioDir, { recursive: true })
      }
      return { success: true, path: projectDir }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:writeJson', async (_, filePath: string, data: any) => {
    try {
      const normalizedPath = normalize(filePath)
      const dir = dirname(normalizedPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(normalizedPath, JSON.stringify(data, null, 2), 'utf-8')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:readJson', async (_, filePath: string) => {
    try {
      const normalizedPath = normalize(filePath)
      if (!existsSync(normalizedPath)) {
        return { success: false, error: 'File not found', data: null }
      }
      const content = readFileSync(normalizedPath, 'utf-8')
      return { success: true, data: JSON.parse(content) }
    } catch (error: any) {
      return { success: false, error: error.message, data: null }
    }
  })

  ipcMain.handle('storage:writeFile', async (_, filePath: string, buffer: ArrayBuffer) => {
    try {
      const normalizedPath = normalize(filePath)
      const dir = dirname(normalizedPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(normalizedPath, Buffer.from(buffer))
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:readFile', async (_, filePath: string) => {
    try {
      const normalizedPath = normalize(filePath)
      if (!existsSync(normalizedPath)) {
        return { success: false, error: 'File not found', data: null }
      }
      const content = readFileSync(normalizedPath)
      return { success: true, data: content }
    } catch (error: any) {
      return { success: false, error: error.message, data: null }
    }
  })

  ipcMain.handle('storage:deleteFile', async (_, filePath: string) => {
    try {
      const normalizedPath = normalize(filePath)
      if (existsSync(normalizedPath)) {
        unlinkSync(normalizedPath)
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:deleteFolder', async (_, folderPath: string) => {
    try {
      const normalizedPath = normalize(folderPath)
      if (existsSync(normalizedPath)) {
        const { rmSync } = require('fs')
        rmSync(normalizedPath, { recursive: true, force: true })
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:fileExists', async (_, filePath: string) => {
    return existsSync(normalize(filePath))
  })

  ipcMain.handle('storage:listFiles', async (_, dirPath: string) => {
    try {
      const normalizedPath = normalize(dirPath)
      if (!existsSync(normalizedPath)) {
        return { success: true, files: [] }
      }
      const files = readdirSync(normalizedPath).map(name => {
        const fullPath = join(normalizedPath, name)
        const stats = statSync(fullPath)
        return {
          name,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedAt: stats.mtimeMs
        }
      })
      return { success: true, files }
    } catch (error: any) {
      return { success: false, error: error.message, files: [] }
    }
  })

  ipcMain.handle('storage:downloadFile', async (_, url: string, destPath: string) => {
    try {
      const normalizedPath = normalize(destPath)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const dir = dirname(normalizedPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(normalizedPath, Buffer.from(arrayBuffer))
      return { success: true, path: normalizedPath }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:renameDirectory', async (_, oldPath: string, newPath: string) => {
    try {
      const normalizedOldPath = normalize(oldPath)
      const normalizedNewPath = normalize(newPath)

      if (!existsSync(normalizedOldPath)) {
        return { success: false, error: 'Source directory does not exist' }
      }

      if (existsSync(normalizedNewPath)) {
        return { success: false, error: 'Target directory already exists' }
      }

      const parentDir = dirname(normalizedNewPath)
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true })
      }

      renameSync(normalizedOldPath, normalizedNewPath)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:migrateProjects', async (_, oldPath: string, newPath: string) => {
    try {
      const normalizedOldPath = normalize(oldPath)
      const normalizedNewPath = normalize(newPath)

      if (!existsSync(normalizedOldPath)) {
        return { success: true, message: 'Old path does not exist, nothing to migrate' }
      }

      if (!existsSync(normalizedNewPath)) {
        mkdirSync(normalizedNewPath, { recursive: true })
      }

      const entries = readdirSync(normalizedOldPath, { withFileTypes: true })
      let migratedCount = 0

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectDir = join(normalizedOldPath, entry.name)
          const canvasFile = join(projectDir, 'canvas.json')

          if (existsSync(canvasFile)) {
            const destDir = join(normalizedNewPath, entry.name)

            if (!existsSync(destDir)) {
              mkdirSync(destDir, { recursive: true })

              const subEntries = readdirSync(projectDir, { withFileTypes: true })
              for (const subEntry of subEntries) {
                const srcPath = join(projectDir, subEntry.name)
                const destPath = join(destDir, subEntry.name)

                if (subEntry.isDirectory()) {
                  mkdirSync(destPath, { recursive: true })
                  const files = readdirSync(srcPath)
                  for (const file of files) {
                    const srcFile = join(srcPath, file)
                    const destFile = join(destPath, file)
                    const content = readFileSync(srcFile)
                    writeFileSync(destFile, content)
                  }
                } else {
                  const content = readFileSync(srcPath)
                  writeFileSync(destPath, content)
                }
              }
              migratedCount++
            }
          }
        }
      }

      return { success: true, migratedCount }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('storage:getDefaultPath', async () => {
    return join(app.getPath('documents'), 'jike-projects')
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
