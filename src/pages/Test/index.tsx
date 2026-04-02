
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileIcon, X } from 'lucide-react'
import { uploadFileToOSS } from '@/utils/oss'

function UploadZone() {
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<{ url: string; name: string } | null>(null)
  const [error, setError] = useState('')

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const target = files[0]
    setUploading(true)
    setError('')
    setFile(null)

    try {
      const result = await uploadFileToOSS(target)
      setFile(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }, [])

  const dropzone = useDropzone({
    onDrop,
    multiple: false,
    disabled: uploading,
  })

  const reset = () => {
    setFile(null)
    setError('')
  }

  return (
    <div className="border-2 border-dashed border-white/[0.15] rounded-xl p-12 text-center">
      <div
        {...dropzone.getRootProps()}
        className={`cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...dropzone.getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-cyan-400/60" />
        <p className="text-white/60">拖拽文件到此处，或点击选择</p>
        <p className="text-xs text-white/40 mt-2">支持任意文件类型</p>
      </div>

      {/* 上传成功 */}
      {file && (
        <div className="mt-6">
          <div className="flex items-center justify-center gap-3 p-4 bg-white/5 rounded-lg">
            <FileIcon className="w-6 h-6 text-cyan-400/60" />
            <div className="text-left">
              <p className="text-sm text-white/80 truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-white/40 truncate max-w-xs">{file.url}</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-4 px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg"
          >
            重新上传
          </button>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="mt-4 text-red-400">
          <p>{error}</p>
          <button
            onClick={reset}
            className="mt-2 px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg"
          >
            重试
          </button>
        </div>
      )}
    </div>
  )
}


export default function TestPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,240,255,0.08)_0%,transparent_60%)]" />
      </div>

      <main className="flex-1 overflow-y-auto scroll-smooth p-8">
        <div className="flex justify-between items-center mb-8 border-b border-white/[0.08] pb-4">
          <h1 className="text-2xl font-semibold tracking-wider text-white/80 uppercase">
            TEST // 测试页面
          </h1>
        </div>

        <div className="max-w-xl mx-auto">
          <UploadZone />
        </div>
      </main>
    </div>
  )
}
