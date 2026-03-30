import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileText as TextIcon, X, Pencil, Upload, X as CloseIcon } from 'lucide-react'
import { getProjectList, createProject, deleteProject, updateProject, type ProjectMeta } from '@/utils/projectStorage'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { uploadImageFile } from '@/api/ai'

export default function ProjectListPage() {
    const navigate = useNavigate()
    const [projects, setProjects] = useState<ProjectMeta[]>([])
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [projectToDelete, setProjectToDelete] = useState<ProjectMeta | null>(null)
  const [projectToEdit, setProjectToEdit] = useState<ProjectMeta | null>(null)

  // 创建表单
    const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCover, setNewProjectCover] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [newProjectType, setNewProjectType] = useState<'video' | 'script'>('video')
  const [coverPreview, setCoverPreview] = useState('')
  const coverFileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  // 编辑表单
  const [editName, setEditName] = useState('')
  const [editCover, setEditCover] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCoverPreview, setEditCoverPreview] = useState('')
  const editCoverFileInputRef = useRef<HTMLInputElement>(null)
  const [isEditUploading, setIsEditUploading] = useState(false)

    // 加载项目列表
    useEffect(() => {
        const loadedProjects = getProjectList()
        setProjects(loadedProjects)
    }, [])

    // 处理项目卡片点击
    const handleProjectClick = (projectId: string) => {
        navigate(`/canvas/${projectId}`)
    }

  // 重置创建表单状态
  const resetCreateFormState = () => {
        setNewProjectName('')
      setNewProjectCover('')
      setNewProjectDesc('')
    setNewProjectType('video')
      setCoverPreview('')
      setIsUploading(false)
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = ''
      }
  }

  // 打开创建项目弹窗
  const openCreateDialog = () => {
    resetCreateFormState()
        setIsCreateDialogOpen(true)
    }

    // 处理封面文件选择（创建）
    const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        // 生成本地预览 URL
        const previewUrl = URL.createObjectURL(file)
        setCoverPreview(previewUrl)
      }
    }

    // 删除封面（创建）
    const handleRemoveCover = () => {
      setCoverPreview('')
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = ''
      }
    }

    // 确认创建项目
    const handleConfirmCreate = async () => {
      setIsUploading(true)
      let coverUrl = newProjectCover

      // 如果选择了新文件，先上传
      if (coverPreview && coverFileInputRef.current?.files?.[0]) {
        const uploadedUrl = await uploadImageFile(coverFileInputRef.current.files[0])
        if (uploadedUrl) {
          coverUrl = uploadedUrl
        }
      }

      createProject(
        newProjectName || undefined,
        coverUrl || undefined,
        newProjectDesc || undefined,
        newProjectType
      )
      setProjects(getProjectList())
      setIsUploading(false)
      setIsCreateDialogOpen(false)
    }

    // 取消创建
    const handleCancelCreate = () => {
        setIsCreateDialogOpen(false)
      resetCreateFormState()
    }

    // 打开删除确认弹窗
    const openDeleteDialog = (e: React.MouseEvent, project: ProjectMeta) => {
        e.stopPropagation()
        setProjectToDelete(project)
        setIsDeleteDialogOpen(true)
    }

    // 确认删除项目
    const handleConfirmDelete = () => {
        if (projectToDelete) {
            deleteProject(projectToDelete.id)
            setProjects(getProjectList())
        }
        setIsDeleteDialogOpen(false)
        setProjectToDelete(null)
    }

    // 取消删除
    const handleCancelDelete = () => {
        setIsDeleteDialogOpen(false)
        setProjectToDelete(null)
    }

  // 重置编辑表单状态
  const resetEditFormState = () => {
    setEditName('')
    setEditCover('')
    setEditDesc('')
    setEditCoverPreview('')
    setIsEditUploading(false)
    if (editCoverFileInputRef.current) {
      editCoverFileInputRef.current.value = ''
    }
  }

  // 打开编辑弹窗
  const openEditDialog = (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation()
    // 先重置表单状态，再回显项目数据
    resetEditFormState()
    setProjectToEdit(project)
    setEditName(project.name)
    setEditCover(project.coverUrl || '')
    setEditDesc(project.description || '')
    setIsEditDialogOpen(true)
  }

  // 处理封面文件选择（编辑）
  const handleEditCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 生成本地预览 URL
      const previewUrl = URL.createObjectURL(file)
      setEditCoverPreview(previewUrl)
    }
  }

  // 删除封面（编辑）
  const handleEditRemoveCover = () => {
    setEditCoverPreview('')
    if (editCoverFileInputRef.current) {
      editCoverFileInputRef.current.value = ''
    }
  }

  // 确认编辑
  const handleConfirmEdit = async () => {
    if (projectToEdit) {
      setIsEditUploading(true)
      let coverUrl = editCover

      // 如果选择了新文件，先上传
      if (editCoverPreview && editCoverFileInputRef.current?.files?.[0]) {
        const uploadedUrl = await uploadImageFile(editCoverFileInputRef.current.files[0])
        if (uploadedUrl) {
          coverUrl = uploadedUrl
        }
      }

      updateProject(projectToEdit.id, {
        name: editName,
        coverUrl: coverUrl || undefined,
        description: editDesc || undefined,
      })
      setProjects(getProjectList())
      setIsEditUploading(false)
    }
    setIsEditDialogOpen(false)
    setProjectToEdit(null)
      resetEditFormState()
    }

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditDialogOpen(false)
    setProjectToEdit(null)
      resetEditFormState()
    }

    return (
        <div className="min-h-screen bg-[#050508] text-white flex flex-col overflow-hidden relative">
            {/* 背景光效 */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,240,255,0.08)_0%,transparent_60%)]" />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                        backgroundSize: '30px 30px'
                    }}
                />
            </div>

            {/* 主内容区 */}
            <main className="flex-1 overflow-y-auto scroll-smooth p-8">
                    {/* 页面标题 */}
                    <div className="flex justify-between items-center mb-8 border-b border-white/[0.08] pb-4">
                        <h1 className="text-2xl font-semibold tracking-wider text-white/80 uppercase">
                            PROJECTS // 项目管理
                        </h1>

                    </div>

                    {/* 空状态提示 */}
                    {projects.length === 0 && (
                        <div className="text-center text-white/40 mt-20">
                            <p className="text-lg mb-2">还没有任何项目</p>
                            <p className="text-sm">点击右下角的 + 按钮创建第一个项目</p>
                        </div>
                    )}

                    {/* Grid布局 - 响应式展示项目卡片 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                        {/* 新建项目卡片 */}
                        <div
                            onClick={openCreateDialog}
                            className="relative aspect-square bg-[rgba(15,15,20,0.4)] border border-dashed border-white/20 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-white/40 hover:border-[#00F0FF] hover:border-solid hover:bg-[rgba(0,240,255,0.05)] hover:text-[#00F0FF] hover:shadow-[0_0_20px_rgba(0,240,255,0.1)] group"
                        >
                            <Plus size={32} />
                            <span className="text-sm tracking-wider">NEW PROJECT</span>
                        </div>

                        {/* 项目列表 */}
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => handleProjectClick(project.id)}
                            className="relative aspect-square bg-[rgba(15,15,20,0.4)] border border-white/[0.08] rounded-xl cursor-pointer hover:border-[rgba(0,240,255,0.4)] hover:shadow-[0_10px_30px_rgba(0,240,255,0.1)] transition-all flex flex-col items-center justify-center p-4 group overflow-hidden"
                            >
                                {/* 类型标签 */}
                                <div className="absolute top-3 left-3 px-2 py-1 rounded text-[10px] tracking-wider backdrop-blur-sm flex items-center gap-1 bg-[rgba(0,240,255,0.1)] text-[#00F0FF] border border-[rgba(0,240,255,0.2)]">
                                    <TextIcon size={12} />
                              <span>{project.type === 'video' ? '视频创作' : '剧本创作'}</span>
                                </div>

                            {/* 封面图 / 图标 */}
                            {project.coverUrl ? (
                              <img
                                src={project.coverUrl}
                                alt={project.name}
                                className="w-16 h-16 rounded-lg object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <TextIcon size={40} className="text-white/15 transition-all group-hover:text-[#00F0FF] group-hover:drop-shadow-[0_0_8px_#00F0FF]" />
                            )}

                                {/* 项目名称 */}
                                <span className="text-sm font-medium text-white/80 text-center truncate w-full mt-3">
                                    {project.name}
                                </span>

                            {/* 操作按钮组 - 悬停时显示 */}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* 编辑按钮 */}
                              <button
                                onClick={(e) => openEditDialog(e, project)}
                                className="w-6 h-6 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/40 flex items-center justify-center"
                                title="编辑项目"
                              >
                                <Pencil size={12} />
                              </button>
                              {/* 删除按钮 */}
                              <button
                                onClick={(e) => openDeleteDialog(e, project)}
                                className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 flex items-center justify-center"
                                title="删除项目"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                </main>

            {/* 创建项目弹窗 */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="bg-[#0a0a0f] border-white/[0.08] p-6 w-[420px]">
                    <div className="flex items-center justify-between mb-6">
                        <DialogTitle className="text-white text-lg">创建新项目</DialogTitle>
                        <button
                            onClick={handleCancelCreate}
                            className="text-white/40 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-white/60 mb-2">项目名称（可选）</label>
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="输入项目名称..."
                                className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF] transition-colors"
                            />
                        </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">项目类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewProjectType('video')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm transition-all ${newProjectType === 'video' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/50' : 'bg-white/[0.03] text-white/60 border border-white/[0.08]'}`}
                  >
                    视频创作
                  </button>
                  <button
                    onClick={() => setNewProjectType('script')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm transition-all ${newProjectType === 'script' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/50' : 'bg-white/[0.03] text-white/60 border border-white/[0.08]'}`}
                  >
                    剧本创作
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">封面图（可选）</label>
                {/* 隐藏的文件输入 */}
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileSelect}
                  className="hidden"
                />

                {/* 预览区域 */}
                {coverPreview && (
                  <div className="relative group mb-3">
                    <img
                      src={coverPreview}
                      alt="封面预览"
                      className="w-full h-32 object-cover rounded-lg border border-white/[0.08]"
                    />
                    <button
                      onClick={handleRemoveCover}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/80 hover:bg-black/80 flex items-center justify-center"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                )}

                {/* 上传按钮 */}
                {!coverPreview && (
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    className="w-full px-4 py-8 bg-white/[0.03] border border-dashed border-white/20 rounded-lg text-white/40 hover:border-[#00F0FF] hover:text-[#00F0FF] hover:bg-[rgba(0,240,255,0.05)] transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <Upload size={24} />
                    <span className="text-sm">点击上传封面图</span>
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">项目描述（可选）</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="简要描述项目..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF] transition-colors resize-none"
                />
              </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                className="flex-1 bg-white/[0.03] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"
                                onClick={handleCancelCreate}
                            >
                                取消
                            </Button>
                            <Button
                                variant="blue"
                                className="flex-1 rounded-lg"
                                onClick={handleConfirmCreate}
                            >
                                创建
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        {/* 编辑项目弹窗 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-[#0a0a0f] border-white/[0.08] p-6 w-[420px]">
            <div className="flex items-center justify-between mb-6">
              <DialogTitle className="text-white text-lg">编辑项目</DialogTitle>
              <button
                onClick={handleCancelEdit}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">项目名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="输入项目名称..."
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">封面图（可选）</label>
                {/* 隐藏的文件输入 */}
                <input
                  ref={editCoverFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditCoverFileSelect}
                  className="hidden"
                />

                {/* 预览区域 - 优先显示新上传的预览，否则显示原有封面 */}
                {(editCoverPreview || editCover) && (
                  <div className="relative group mb-3">
                    <img
                      src={editCoverPreview || editCover}
                      alt="封面预览"
                      className="w-full h-32 object-cover rounded-lg border border-white/[0.08]"
                    />
                    {/* 删除按钮 */}
                    <button
                      onClick={editCoverPreview ? handleEditRemoveCover : () => setEditCover('')}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/80 hover:bg-black/80 flex items-center justify-center"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                )}

                {/* 上传按钮 - 只有在删除封面后显示 */}
                {!editCoverPreview && !editCover && (
                  <button
                    type="button"
                    onClick={() => editCoverFileInputRef.current?.click()}
                    className="w-full px-4 py-8 bg-white/[0.03] border border-dashed border-white/20 rounded-lg text-white/40 hover:border-[#00F0FF] hover:text-[#00F0FF] hover:bg-[rgba(0,240,255,0.05)] transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <Upload size={24} />
                    <span className="text-sm">点击上传封面图</span>
                  </button>
                )}

                {/* 更换按钮 - 如果有封面，显示更换按钮 */}
                {(editCoverPreview || editCover) && !editCoverPreview && (
                  <button
                    type="button"
                    onClick={() => editCoverFileInputRef.current?.click()}
                    className="w-full px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white/60 hover:border-[#00F0FF] hover:text-[#00F0FF] transition-all text-sm"
                  >
                    更换封面
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">项目描述（可选）</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="简要描述项目..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"
                  onClick={handleCancelEdit}
                >
                  取消
                </Button>
                <Button
                  variant="blue"
                  className="flex-1 rounded-lg"
                  onClick={handleConfirmEdit}
                >
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

            {/* 删除确认弹窗 */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="bg-[#0a0a0f] border-white/[0.08] p-6 w-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <DialogTitle className="text-white text-lg">删除项目</DialogTitle>
                        <button
                            onClick={handleCancelDelete}
                            className="text-white/40 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="py-4">
                        <p className="text-white/60">
                            确定要删除项目 <span className="font-medium text-white">"{projectToDelete?.name}"</span> 吗？删除后无法恢复。
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            className="flex-1 bg-white/[0.03] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"
                            onClick={handleCancelDelete}
                        >
                            取消
                        </Button>
                        <Button
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                            onClick={handleConfirmDelete}
                        >
                            删除
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
