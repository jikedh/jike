"use client"

import * as React from "react"

interface PanoramaUploadProps {
    onFileSelect: (file: File) => void
}

export function PanoramaUpload({ onFileSelect }: PanoramaUploadProps) {
    const [isDragActive, setIsDragActive] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    // 拖拽事件处理
    const handleDragEnter = React.useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragActive(true)
    }, [])

    const handleDragLeave = React.useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragActive(false)
    }, [])

    const handleDragOver = React.useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const handleDrop = React.useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragActive(false)

        const files = e.dataTransfer.files
        if (files.length > 0) {
            const file = files[0]
            if (file.type.startsWith("image/")) {
                onFileSelect(file)
            }
        }
    }, [onFileSelect])

    const handleFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            onFileSelect(files[0])
        }
        // 重置 input 以便选择同一文件
        if (inputRef.current) {
            inputRef.current.value = ""
        }
    }, [onFileSelect])

    const handleClick = React.useCallback(() => {
        inputRef.current?.click()
    }, [])

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-hidden">
            {/* 装饰性背景光晕 */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[15%] w-72 h-72 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob" />
                <div className="absolute top-[20%] right-[15%] w-72 h-72 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[15%] left-[30%] w-72 h-72 bg-cyan-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-4000" />
            </div>

            {/* 玻璃拟态主卡片 */}
            <div className="glass-panel p-10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] border border-white/10 max-w-xl w-full text-center mx-4 relative z-10 backdrop-blur-2xl bg-white/5">
                <div className="mb-8">
                    <h1 className="text-4xl font-extrabold mb-5 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
                        360° 全景浏览器
                    </h1>
                    <p className="text-gray-300 text-sm leading-relaxed px-4">
                        该应用将360VR全景图，转化为可观看浏览的视角，并且提供多种截图方式。
                    </p>
                </div>

                {/* 拖拽上传区域 */}
                <div
                    onClick={handleClick}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`
                        border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-300
                        ${isDragActive
                            ? "border-blue-400 bg-blue-500/20"
                            : "border-gray-500/50 hover:border-blue-400 hover:bg-blue-500/10"
                        }
                        bg-black/20
                    `}
                >
                    <div className={`
                        bg-gray-800/50 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center
                        transition-transform duration-300
                        ${isDragActive ? "scale-110" : "group-hover:scale-110"}
                    `}>
                        <svg
                            className={`w-10 h-10 transition-colors ${isDragActive ? "text-blue-400" : "text-gray-400 group-hover:text-blue-400"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                        </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-200 group-hover:text-white transition-colors">
                        点击选择文件，或将图片拖拽至此
                    </p>
                    <p className="text-xs text-gray-500 mt-3 font-light">
                        支持等距柱状投影全景图 (JPG / PNG / WEBP)
                    </p>
                </div>

                {/* 底部作者署名 */}
                <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center">
                    <div className="text-xs text-gray-400 tracking-wider">
                        Designed by <span className="text-gray-200 font-medium">DeepWhite深白色</span>
                    </div>
                </div>
            </div>

            {/* 隐藏的文件输入框 */}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    )
}
