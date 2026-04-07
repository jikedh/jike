const CANVAS_FILE_NAME = 'canvas.json'

const joinPath = (...parts: string[]): string => {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
}

export type LocalStorageResult = {
  success: boolean
  error?: string
  data?: any
}

export const localStorageService = {
  isAvailable: (): boolean => {
    return typeof window !== 'undefined' && !!window.storage
  },

  getStoragePath: (): string | null => {
    const settings = localStorage.getItem('canvas-chat-settings')
    if (!settings) return null
    try {
      const parsed = JSON.parse(settings)
      return parsed.state?.storagePath || null
    } catch {
      return null
    }
  },

  ensureProjectDir: async (basePath: string, projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }
    return window.storage.ensureProjectDir(basePath, projectName)
  },

  saveCanvasData: async (projectId: string, projectName: string, data: any): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const ensureResult = await localStorageService.ensureProjectDir(basePath, projectName)
    if (!ensureResult.success) {
      return ensureResult
    }

    const filePath = joinPath(basePath, projectName, CANVAS_FILE_NAME)
    return window.storage.writeJson(filePath, data)
  },

  loadCanvasData: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, CANVAS_FILE_NAME)
    return window.storage.readJson(filePath)
  },

  saveImage: async (projectName: string, fileName: string, buffer: ArrayBuffer): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'image', fileName)
    return window.storage.writeFile(filePath, buffer)
  },

  saveGeneratedImage: async (projectName: string, fileName: string, buffer: ArrayBuffer): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'generate_image', fileName)
    return window.storage.writeFile(filePath, buffer)
  },

  saveVideo: async (projectName: string, fileName: string, buffer: ArrayBuffer): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'video', fileName)
    return window.storage.writeFile(filePath, buffer)
  },

  saveGeneratedVideo: async (projectName: string, fileName: string, buffer: ArrayBuffer): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'generate_video', fileName)
    return window.storage.writeFile(filePath, buffer)
  },

  saveAudio: async (projectName: string, fileName: string, buffer: ArrayBuffer): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'audio', fileName)
    return window.storage.writeFile(filePath, buffer)
  },

  downloadImage: async (projectName: string, fileName: string, url: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'image', fileName)
    return window.storage.downloadFile(url, filePath)
  },

  downloadGeneratedImage: async (projectName: string, fileName: string, url: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'generate_image', fileName)
    return window.storage.downloadFile(url, filePath)
  },

  downloadVideo: async (projectName: string, fileName: string, url: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'video', fileName)
    return window.storage.downloadFile(url, filePath)
  },

  downloadGeneratedVideo: async (projectName: string, fileName: string, url: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'generate_video', fileName)
    return window.storage.downloadFile(url, filePath)
  },

  downloadAudio: async (projectName: string, fileName: string, url: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, 'audio', fileName)
    return window.storage.downloadFile(url, filePath)
  },

  saveCoverImage: async (projectName: string, buffer: ArrayBuffer, extension: string = 'png'): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const filePath = joinPath(basePath, projectName, `cover.${extension}`)
    return window.storage.writeFile(filePath, buffer)
  },

  downloadCoverImage: async (projectName: string, url: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const ext = url.split('.').pop()?.toLowerCase() || 'png'
    const filePath = joinPath(basePath, projectName, `cover.${ext}`)
    return window.storage.downloadFile(url, filePath)
  },

  listImages: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const dirPath = joinPath(basePath, projectName, 'image')
    return window.storage.listFiles(dirPath)
  },

  listGeneratedImages: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const dirPath = joinPath(basePath, projectName, 'generate_image')
    return window.storage.listFiles(dirPath)
  },

  listVideos: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const dirPath = joinPath(basePath, projectName, 'video')
    return window.storage.listFiles(dirPath)
  },

  listGeneratedVideos: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const dirPath = joinPath(basePath, projectName, 'generate_video')
    return window.storage.listFiles(dirPath)
  },

  listAudio: async (projectName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    const dirPath = joinPath(basePath, projectName, 'audio')
    return window.storage.listFiles(dirPath)
  },

  deleteFile: async (filePath: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    return window.storage.deleteFile(filePath)
  },

  fileExists: async (filePath: string): Promise<boolean> => {
    if (!window.storage) {
      return false
    }

    return window.storage.fileExists(filePath)
  },

  renameProject: async (oldName: string, newName: string): Promise<LocalStorageResult> => {
    if (!window.storage) {
      return { success: false, error: 'Storage API not available' }
    }

    const basePath = localStorageService.getStoragePath()
    if (!basePath) {
      return { success: false, error: 'Storage path not configured' }
    }

    return window.storage.renameDirectory(
      joinPath(basePath, oldName),
      joinPath(basePath, newName)
    )
  },

  getDefaultPath: async (): Promise<string> => {
    if (!window.storage) {
      return ''
    }

    return window.storage.getDefaultPath()
  },
}

export const generateFileName = (prefix: string, extension: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}.${extension}`
}

export const generateSimpleFileName = (extension: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}_${random}.${extension}`
}

export const getImageLocalPath = (basePath: string, projectName: string, fileName: string): string => {
  return joinPath(basePath, projectName, 'image', fileName)
}

export const getGeneratedImageLocalPath = (basePath: string, projectName: string, fileName: string): string => {
  return joinPath(basePath, projectName, 'generate_image', fileName)
}

export const getVideoLocalPath = (basePath: string, projectName: string, fileName: string): string => {
  return joinPath(basePath, projectName, 'video', fileName)
}

export const getGeneratedVideoLocalPath = (basePath: string, projectName: string, fileName: string): string => {
  return joinPath(basePath, projectName, 'generate_video', fileName)
}

export const getAudioLocalPath = (basePath: string, projectName: string, fileName: string): string => {
  return joinPath(basePath, projectName, 'audio', fileName)
}

export const getCoverImagePath = (basePath: string, projectName: string, extension: string = 'png'): string => {
  return joinPath(basePath, projectName, `cover.${extension}`)
}
