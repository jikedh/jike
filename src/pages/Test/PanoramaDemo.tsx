"use client"

import * as React from "react"
import { PanoramaViewer } from "@/components/panorama/PanoramaViewer"

export default function PanoramaDemo() {
    // 控制全景浏览器是否打开
    const [isOpen, setIsOpen] = React.useState(false)
    // 图片URL输入
    const [imageUrl, setImageUrl] = React.useState("")

    // 打开全景浏览器
    const handleOpen = React.useCallback(() => {
        if (imageUrl.trim()) {
            setIsOpen(true)
        }
    }, [imageUrl])

    // 监听回车键
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleOpen()
        }
    }, [handleOpen])

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">360° 全景浏览器</h1>
            
            {/* URL输入区域 */}
            <div className="flex gap-3 max-w-2xl">
                <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入全景图片URL"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                    onClick={handleOpen}
                    disabled={!imageUrl.trim()}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    打开全景浏览器
                </button>
            </div>

            <PanoramaViewer
                open={isOpen}
                onClose={() => setIsOpen(false)}
                initialImage={imageUrl}
            />
        </div>
    )
}
