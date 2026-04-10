import { IconBolt, IconDownload, IconFolder, IconRestore, IconUpload, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Modal, ModalContent, ModalDescription, ModalTitle } from '@/components/ui/modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CANVAS_CHAT_MODELS } from '@/constants/ai-models'
import { CANVAS_CHAT_PERSONAS, NO_CHAT_PERSONA_ID } from '@/constants/chat-personas'
import { useChatSettingsStore } from '@/store/chatSettingsStore'
import { Switch } from '@/components/ui/switch'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import useMessage from '@/hooks/useMessage'
import { cn } from '@/utils/utils'
import { clearProjectList } from '@/utils/projectStorage'

type SettingsModalProps = {
    open: boolean
    onClose: () => void
    isFirstLogin?: boolean
}

const settingSections = [
    { id: 'general', label: '通用设置' },
    { id: 'canvas', label: '画布设置' },
    { id: 'interaction', label: '节点交互' },
    { id: 'ai', label: 'AI 助手' },
    { id: 'collab', label: '协作通知' },
    { id: 'data', label: '数据与版本' },
    { id: 'shortcuts', label: '快捷键' },
    { id: 'labs', label: '实验功能', devOnly: true },
    { id: 'about', label: '关于支持' },
]

const sectionPlaceholderMap = {
    general: [
        { label: '自动保存', type: 'toggle' },
    ],
    canvas: [
        { label: '网格显示', type: 'toggle' },
        { label: '吸附网格', type: 'toggle' },
    ],
    interaction: [
        { label: '拖拽辅助线', type: 'toggle' },
    ],
    ai: [],
    collab: [
        { label: '@我提醒', type: 'toggle' },
    ],
    data: [
        { label: '自动备份', type: 'toggle' },
    ],
    shortcuts: [
        { label: '开启单键模式', type: 'toggle' },
        { label: '冲突提示', type: 'toggle' },
    ],
    labs: [
        { label: 'Beta 功能总开关', type: 'toggle' },
        { label: '轻量渲染模式', type: 'toggle' },
    ],
    about: [],
}

const sectionIdSet = new Set(settingSections.map((item) => item.id))

export const SettingsModal = ({ open, onClose, isFirstLogin = false }: SettingsModalProps) => {
    const [activeSection, setActiveSection] = useState(isFirstLogin ? 'data' : settingSections[0].id)
    const [isDev, setIsDev] = useState(false)
  const { defaultModel, defaultPersonaId, autoSaveEnabled, gridVisible, snapToGrid, nodeSearchVisible, devToolsVisible, storagePath, setDefaultModel, setDefaultPersonaId, setAutoSaveEnabled, setGridVisible, setSnapToGrid, setNodeSearchVisible, setDevToolsVisible, setStoragePath, resetToDefault } = useChatSettingsStore()
    const { success, error } = useMessage()
    const exportCanvasData = useCanvasFlowStore((state) => state.exportCanvasData)
    const importCanvasData = useCanvasFlowStore((state) => state.importCanvasData)

    // 导入确认弹窗状态
    const [importConfirmOpen, setImportConfirmOpen] = useState(false)
    const [pendingImportData, setPendingImportData] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 检测开发环境
    useEffect(() => {
        const checkDevEnvironment = async () => {
            try {
                const debugApi = (window as any).debug
                if (debugApi?.isDev) {
                    const isDevEnv = await debugApi.isDev()
                    setIsDev(isDevEnv)
                } else {
                    // Web 版本或非 Electron 环境，假设为生产环境
                    setIsDev(false)
                }
            } catch (e) {
                // 出错时假设为生产环境
                setIsDev(false)
            }
        }
        checkDevEnvironment()
    }, [])

    useEffect(() => {
        if (open && !storagePath && window.storage) {
            window.storage.getDefaultPath().then((defaultPath) => {
                if (defaultPath) {
                    setStoragePath(defaultPath)
                }
            })
        }
    }, [open, storagePath, setStoragePath])

    const handleSelectStoragePath = async () => {
        if (!window.storage) {
            error('存储功能不可用')
            return
        }

        const oldPath = storagePath
        const selectedPath = await window.storage.selectDirectory()

        if (selectedPath && selectedPath !== oldPath) {
            if (oldPath) {
                const migrateResult = await window.storage.migrateProjects(oldPath, selectedPath)
                if (migrateResult.success) {
                    setStoragePath(selectedPath)
                    clearProjectList()
                    if (migrateResult.migratedCount && migrateResult.migratedCount > 0) {
                        success(`存储路径已更新，已迁移 ${migrateResult.migratedCount} 个项目`)
                    } else {
                        success('存储路径已更新')
                    }
                } else {
                    error(`迁移失败: ${migrateResult.error}`)
                }
            } else {
                setStoragePath(selectedPath)
                clearProjectList()
                success('存储路径已更新')
            }
        }
    }

    const currentSectionItems = useMemo(() => {
        if (!sectionIdSet.has(activeSection)) {
            return []
        }

        return sectionPlaceholderMap[activeSection as keyof typeof sectionPlaceholderMap] ?? []
    }, [activeSection])

    // 导出画布数据
    const handleExport = () => {
        const data = exportCanvasData()
        const json = JSON.stringify(data, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `canvas-${Date.now()}.json`
        link.click()
        URL.revokeObjectURL(url)
        success('导出成功')
    }

    // 触发文件选择
    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    // 读取文件并弹出确认框
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string)
                setPendingImportData(data)
                setImportConfirmOpen(true)
            } catch {
                error('JSON 文件格式错误')
            }
        }
        reader.readAsText(file)
        event.target.value = ''
    }

    // 确认导入
    const handleConfirmImport = () => {
        if (pendingImportData) {
            importCanvasData(pendingImportData)
            success('导入成功')
        }
        setImportConfirmOpen(false)
        setPendingImportData(null)
    }

  // 切换 Electron 开发者工具
  const handleToggleElectronDevTools = async () => {
    const debugApi = (window as any).debug

    if (!debugApi?.toggleDevTools) {
      error('当前环境不支持打开开发者工具')
      return
    }

    const result = await debugApi.toggleDevTools()
    if (result.success) {
      success('已切换开发者工具')
      return
    }

    error(result.error || '切换开发者工具失败')
  }

    return (
        <>
        <Modal open={open} onOpenChange={(nextOpen) => !nextOpen && !isFirstLogin && onClose()}>
            <ModalContent aria-label="设置弹窗">
                <div className="flex h-[min(76vh,720px)] flex-col">
                    <header className="flex items-start justify-between border-b border-white/5 px-6 py-5">
                        <div>
                            <ModalTitle>{isFirstLogin ? '欢迎使用即刻' : '画布设置中心'}</ModalTitle>
                            <ModalDescription>{isFirstLogin ? '请先设置项目存储路径，以便保存您的创作内容' : '当前均为占位配置，后续可逐项接入真实能力。'}</ModalDescription>
                        </div>
                        {!isFirstLogin && (
                        <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                            onClick={onClose}
                        >
                            <IconX size={18} />
                        </button>
                        )}
                    </header>

                    <div className={`grid min-h-0 flex-1 ${isFirstLogin ? '' : 'grid-cols-[220px_1fr]'}`}>
                        {!isFirstLogin && (
                        <aside className="border-r border-white/5 bg-black/20 p-3">
                            <div className="space-y-1">
                    {settingSections.filter(section => !((section as any).devOnly && !isDev)).map((section) => {
                      const getIcon = () => {
                        if (section.id === 'data') return <IconDownload size={14} />
                        if (section.id === 'about') return <IconBolt size={14} />
                        return <IconBolt size={14} />
                      }

                      return (
                        <button
                          key={section.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                            activeSection === section.id
                              ? 'bg-[#B43FEB]/10 text-[#B43FEB]'
                              : 'text-white/60 hover:bg-white/5 hover:text-white/80',
                          )}
                          onClick={() => setActiveSection(section.id)}
                        >
                          {getIcon()}
                          <span>{section.label}</span>
                        </button>
                      )
                    })}
                            </div>
                        </aside>
                        )}

                        <main className="min-h-0 overflow-auto px-6 py-5">
                            <div className="space-y-3">
                                {/* AI 助手 - 真实配置 */}
                                {activeSection === 'ai' && (
                                    <>
                                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                            <div className="mb-3 text-sm font-medium text-white/80">默认模型</div>
                                            <Select value={defaultModel} onValueChange={setDefaultModel}>
                                                <SelectTrigger className="h-9 w-full border-white/10 bg-black/50 text-sm text-white">
                                                    <SelectValue placeholder="请选择模型" />
                                                </SelectTrigger>
                                                <SelectContent align="end" className="max-h-60">
                                                    {CANVAS_CHAT_MODELS.map((m) => (
                                                        <SelectItem key={m.model} value={m.model}>
                                                            {m.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </section>

                                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                            <div className="mb-3 text-sm font-medium text-white/80">默认人设</div>
                                            <Select value={defaultPersonaId} onValueChange={(v) => setDefaultPersonaId(v as typeof defaultPersonaId)}>
                                                <SelectTrigger className="h-9 w-full border-white/10 bg-black/50 text-sm text-white">
                                                    <SelectValue placeholder="请选择人设" />
                                                </SelectTrigger>
                                                <SelectContent align="end">
                                                    <SelectItem value={NO_CHAT_PERSONA_ID}>无（默认）</SelectItem>
                                                    {CANVAS_CHAT_PERSONAS.map((persona) => (
                                                        <SelectItem key={persona.id} value={persona.id}>
                                                            {persona.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </section>
                                    </>
                                )}

                                    {/* 通用设置 - 自动保存开关 */}
                                    {activeSection === 'general' && (
                                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-white/80">自动保存</div>
                                                    <div className="text-xs text-white/40 mt-1">新建或删除节点时自动保存画布</div>
                                                </div>
                                                <Switch checked={autoSaveEnabled} onCheckedChange={setAutoSaveEnabled} />
                                            </div>
                                        </section>
                                )}

                                {/* 画布设置 - 网格显示开关 */}
                                {activeSection === 'canvas' && (
                                    <>
                                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-white/80">网格显示</div>
                                                    <div className="text-xs text-white/40 mt-1">控制画布背景网格线的显示</div>
                                                </div>
                                                <Switch checked={gridVisible} onCheckedChange={setGridVisible} />
                                            </div>
                                        </section>
                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                          <div className="flex items-center justify-between">
                                                <div>
                              <div className="text-sm font-medium text-white/80">吸附网格</div>
                              <div className="text-xs text-white/40 mt-1">拖拽节点时自动吸附到网格点(有助于提高性能)</div>
                            </div>
                            {/* 画布节点吸附网格开关 */}
                            <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
                          </div>
                        </section>
                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                          <div className="flex items-center justify-between">
                            <div>
                                                    <div className="text-sm font-medium text-white/80">节点搜索栏显示</div>
                                                    <div className="text-xs text-white/40 mt-1">控制画布右上角节点搜索栏的显示</div>
                                                </div>
                                                <Switch checked={nodeSearchVisible} onCheckedChange={setNodeSearchVisible} />
                                            </div>
                                        </section>
                                        {/* 调试工具面板开关 */}
                                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-white/80">调试工具面板</div>
                                                    <div className="text-xs text-white/40 mt-1">控制 ReactFlow 调试工具面板的显示</div>
                                                </div>
                            <Switch checked={devToolsVisible} onCheckedChange={setDevToolsVisible} />
                                            </div>
                                        </section>
                                    </>
                                )}

                                {/* 数据与版本 - 导入导出 */}
                                {activeSection === 'data' && (
                                    <>
                                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                            <div className="mb-3 text-sm font-medium text-white/80">项目存储路径</div>
                                            <div className="text-xs text-white/40 mb-3">项目文件将存储在此路径下，包括画布数据、图片、视频和音频文件</div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/60 truncate">
                                                    {storagePath || '未设置'}
                                                </div>
                                                <Button size="sm" variant="blue" onClick={handleSelectStoragePath}>
                                                    <IconFolder size={14} />
                                                    选择路径
                                                </Button>
                                            </div>
                                        </section>
                                        <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                            <div className="mb-3 text-sm font-medium text-white/80">画布数据</div>
                                            <div className="text-xs text-white/40 mb-3">导出或导入画布的 JSON 数据</div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="blue" onClick={handleExport}>
                                                    <IconDownload size={14} />
                                                    导出
                                                </Button>
                                                <Button size="sm" onClick={handleImportClick}>
                                                    <IconUpload size={14} />
                                                    导入
                                                </Button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".json"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                />
                                            </div>
                                        </section>
                                    </>
                                )}

                    {/* 实验功能 - Electron 开发者工具 */}
                    {activeSection === 'labs' && isDev && (
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">Electron 开发者工具</div>
                        <div className="text-xs text-white/40 mb-3">点击后可打开或关闭 Electron 控制台（DevTools）</div>
                        <Button size="sm" variant="blue" onClick={handleToggleElectronDevTools}>
                          <IconBolt size={14} />
                          切换开发者工具
                        </Button>
                      </section>
                    )}

                    {currentSectionItems.filter((item) => {
                      // 已接入真实功能的项不再走占位渲染
                      if (activeSection === 'general' && item.label === '自动保存') return false
                      if (activeSection === 'canvas' && (item.label === '网格显示' || item.label === '吸附网格')) return false
                      return true
                    }).map((item) => (
                                    <section key={item.label} className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                                        <div className="mb-3 text-sm font-medium text-white/80">{item.label}</div>

                                        {item.type === 'toggle' && (
                                            <div className="flex items-center justify-between rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-white/40">
                                                <span>占位开关（暂不生效）</span>
                                                <span className="rounded-md bg-white/5 px-2 py-1">OFF</span>
                                            </div>
                                        )}
                                    </section>
                                ))}
                            </div>
                        </main>
                    </div>

                    <footer className="flex items-center justify-between border-t border-white/5 px-6 py-4">
                        {!isFirstLogin && (
                        <Button variant="blue" size="sm" onClick={resetToDefault}>
                            <IconRestore size={14} />
                            恢复默认
                        </Button>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                            {!isFirstLogin && (
                            <Button size="sm" onClick={onClose}>
                                取消
                            </Button>
                            )}
                            <Button size="sm" variant="blue" onClick={onClose}>
                                {isFirstLogin ? '确认' : '保存'}
                            </Button>
                        </div>
                    </footer>
                </div>
            </ModalContent>
        </Modal>

        {/* 导入确认弹窗 */}
        <Dialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>确认导入</DialogTitle>
                    <DialogDescription>
                        导入将覆盖当前画布的所有内容，此操作不可撤销。是否继续？
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button size="sm" onClick={() => setImportConfirmOpen(false)}>取消</Button>
                    <Button size="sm" variant="blue" onClick={handleConfirmImport}>确认导入</Button>
                </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
    )
}
