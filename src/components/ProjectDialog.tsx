import { useState, useRef, useEffect } from 'react'
import { X, Upload, X as CloseIcon } from 'lucide-react'
import { createProject, updateProject, type ProjectMeta } from '@/utils/projectStorage'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { uploadImageFile } from '@/api/ai'

// 项目弹窗组件的props类型定义
interface ProjectDialogProps {
  /** 控制弹窗是否显示 */
  isOpen: boolean
  /** 关闭弹窗的回调函数 */
  onClose: () => void
  /** 编辑模式下的项目数据，如果不传则为创建模式 */
  project?: ProjectMeta | null
  /** 操作成功后的回调函数 */
  onSuccess?: (projectId: string) => void
}

/**
 * 项目弹窗组件（支持创建和编辑）
 */
export default function ProjectDialog({
  isOpen,
  onClose,
  project,
  onSuccess
}: ProjectDialogProps) {
  const isEdit = !!project

  // 表单状态管理
  const [name, setName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'video' | 'script'>('video')
  const [coverPreview, setCoverPreview] = useState('')
  const coverFileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // 当 project 改变时（打开编辑弹窗），回显数据
  useEffect(() => {
    if (project) {
      setName(project.name)
      setCoverUrl(project.coverUrl || '')
      setDescription(project.description || '')
      setType(project.type)
      setCoverPreview('') // 编辑时，如果有原有封面，直接显示 coverUrl
    } else {
      resetFormState()
    }
  }, [project, isOpen])

  /**
   * 重置表单状态到初始值
   */
  const resetFormState = () => {
    setName('')
    setCoverUrl('')
    setDescription('')
    setType('video')
    setCoverPreview('')
    setIsProcessing(false)
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = ''
    }
  }

  /**
   * 处理封面文件选择
   */
  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setCoverPreview(previewUrl)
    }
  }

  /**
   * 删除封面
   */
  const handleRemoveCover = () => {
    setCoverPreview('')
    setCoverUrl('')
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = ''
    }
  }

  /**
   * 确认提交（创建或更新）
   */
  const handleConfirm = async () => {
    setIsProcessing(true)
    let finalCoverUrl = coverUrl

    // 如果选择了新文件，先上传
    if (coverPreview && coverFileInputRef.current?.files?.[0]) {
      const uploadedUrl = await uploadImageFile(coverFileInputRef.current.files[0])
      if (uploadedUrl) {
        finalCoverUrl = uploadedUrl
      }
    }

    let resultId = ''
    if (isEdit && project) {
      updateProject(project.id, {
        name,
        coverUrl: finalCoverUrl || undefined,
        description: description || undefined,
      })
      resultId = project.id
    } else {
      const newProject = createProject(
        name || undefined,
        finalCoverUrl || undefined,
        description || undefined,
        type
      )
      resultId = newProject.id
    }

    setIsProcessing(false)
    onSuccess?.(resultId)
    handleClose()
  }

  /**
   * 处理弹窗关闭
   */
  const handleClose = () => {
    if (!isEdit) resetFormState()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0a0a0f] border-white/[0.08] p-6 w-[420px]">
        <div className="flex items-center justify-between mb-6">
          <DialogTitle className="text-white text-lg">{isEdit ? '编辑项目' : '创建新项目'}</DialogTitle>
          <button
            onClick={handleClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          {/* 项目名称输入 */}
          <div>
            <label className="block text-sm text-white/60 mb-2">项目名称{isEdit ? '' : '（可选）'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入项目名称..."
              className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF] transition-colors"
            />
          </div>

          {/* 项目类型选择 - 仅在创建模式下显示 */}
          {!isEdit && (
            <div>
              <label className="block text-sm text-white/60 mb-2">项目类型</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setType('video')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm transition-all ${type === 'video' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/50' : 'bg-white/[0.03] text-white/60 border border-white/[0.08]'}`}
                >
                  视频创作
                </button>
                <button
                  onClick={() => setType('script')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm transition-all ${type === 'script' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/50' : 'bg-white/[0.03] text-white/60 border border-white/[0.08]'}`}
                >
                  剧本创作
                </button>
              </div>
            </div>
          )}

          {/* 封面图上传 */}
          <div>
            <label className="block text-sm text-white/60 mb-2">封面图（可选）</label>
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverFileSelect}
              className="hidden"
            />

            {/* 预览区域 */}
            {(coverPreview || coverUrl) && (
              <div className="relative group mb-3">
                <img
                  src={coverPreview || coverUrl}
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
            {!coverPreview && !coverUrl && (
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                className="w-full px-4 py-8 bg-white/[0.03] border border-dashed border-white/20 rounded-lg text-white/40 hover:border-[#00F0FF] hover:text-[#00F0FF] hover:bg-[rgba(0,240,255,0.05)] transition-all flex flex-col items-center justify-center gap-2"
              >
                <Upload size={24} />
                <span className="text-sm">点击上传封面图</span>
              </button>
            )}

            {/* 更换按钮 */}
            {(coverPreview || coverUrl) && (
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                className="w-full mt-2 px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white/60 hover:border-[#00F0FF] hover:text-[#00F0FF] transition-all text-sm"
              >
                更换封面
              </button>
            )}
          </div>

          {/* 项目描述 */}
          <div>
            <label className="block text-sm text-white/60 mb-2">项目描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述项目..."
              rows={3}
              className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 outline-none focus:border-[#00F0FF] transition-colors resize-none"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-white/[0.03] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"
              onClick={handleClose}
            >
              取消
            </Button>
            <Button
              variant="blue"
              className="flex-1 rounded-lg"
              onClick={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (isEdit ? '保存中...' : '创建中...') : (isEdit ? '保存' : '创建')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
