/**
 * 项目管理工具函数
 * 负责项目的创建、读取、更新、删除，所有数据存储在 localStorage
 */

// 项目列表存储 key
const PROJECT_LIST_KEY = 'canvas-projects'
// 画布数据存储 key 前缀
const CANVAS_DATA_PREFIX = 'canvas-flow-data-'

// 项目元数据类型
export type ProjectMeta = {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    coverUrl?: string
    description?: string
    type: 'video' | 'script'
}

// 项目列表类型
type ProjectList = {
    version: number
    nextId: number // 下一个项目 ID
    projects: ProjectMeta[]
}

// 当前版本号
const STORAGE_VERSION = 2

/**
 * 获取所有项目列表（按最后编辑时间倒序排列）
 */
export const getProjectList = (): ProjectMeta[] => {
    try {
        const raw = localStorage.getItem(PROJECT_LIST_KEY)
        if (!raw) return []

        const data = JSON.parse(raw) as ProjectList
        if (data.version !== STORAGE_VERSION) return []

        // 按 updatedAt 降序排序，如果 updatedAt 不存在则回退到 createdAt
        return data.projects.sort((a, b) => {
            const timeA = a.updatedAt || a.createdAt
            const timeB = b.updatedAt || b.createdAt
            return timeB - timeA
        })
    } catch {
        return []
    }
}

/**
 * 保存项目列表
 */
const saveProjectList = (projects: ProjectMeta[], nextId: number): void => {
    const data: ProjectList = {
        version: STORAGE_VERSION,
        nextId,
        projects,
    }
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(data))
}

/**
 * 获取下一个项目 ID
 */
const getNextId = (): number => {
    try {
        const raw = localStorage.getItem(PROJECT_LIST_KEY)
        if (!raw) return 1

        const data = JSON.parse(raw) as ProjectList
        return data.nextId || data.projects.length + 1
    } catch {
        return 1
    }
}

/**
 * 创建新项目
 * @param name 项目名称，可选，默认为 "项目 N"
 * @param coverUrl 封面图片 URL，可选
 * @param description 项目描述，可选
 * @param type 项目类型
 */
export const createProject = (
    name?: string,
    coverUrl?: string,
    description?: string,
    type: 'video' | 'script' = 'video'
): ProjectMeta => {
    const now = Date.now()
    const projects = getProjectList()
    const nextId = getNextId()

    const newProject: ProjectMeta = {
        id: String(nextId),
        name: name || `项目 ${nextId}`,
        createdAt: now,
        updatedAt: now,
        coverUrl,
        description,
        type,
    }

    // 新项目添加到列表
    projects.push(newProject)
    saveProjectList(projects, nextId + 1)

    return newProject
}

/**
 * 更新项目元数据并刷新最后编辑时间
 */
export const updateProject = (projectId: string, updates: Partial<Omit<ProjectMeta, 'id' | 'createdAt'>>): void => {
    try {
        const raw = localStorage.getItem(PROJECT_LIST_KEY)
        if (!raw) return

        const data = JSON.parse(raw) as ProjectList
        const projectIndex = data.projects.findIndex(p => p.id === projectId)

        if (projectIndex !== -1) {
            data.projects[projectIndex] = {
                ...data.projects[projectIndex],
                ...updates,
                updatedAt: Date.now() // 强制更新编辑时间
            }
            saveProjectList(data.projects, data.nextId)
        }
    } catch (error: any) {
        console.error('Failed to update project:', error)
    }
}

/**
 * 删除项目（包括其画布数据）
 */
export const deleteProject = (id: string): boolean => {
    try {
        const raw = localStorage.getItem(PROJECT_LIST_KEY)
        if (!raw) return false

        const data = JSON.parse(raw) as ProjectList
        const index = data.projects.findIndex(p => p.id === id)

        if (index === -1) return false

        // 删除项目元数据
        data.projects.splice(index, 1)
        localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(data))

        // 删除项目画布数据
        localStorage.removeItem(getCanvasDataKey(id))

        return true
    } catch {
        return false
    }
}

/**
 * 获取项目画布数据的存储 key
 */
export const getCanvasDataKey = (projectId: string): string => {
    return `${CANVAS_DATA_PREFIX}${projectId}`
}

/**
 * 检查项目是否存在
 */
export const projectExists = (id: string): boolean => {
    const projects = getProjectList()
    return projects.some(p => p.id === id)
}
