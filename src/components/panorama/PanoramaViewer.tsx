"use client"

import * as React from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { PanoramaCanvas } from "./PanoramaCanvas"
import { PanoramaControls } from "./PanoramaControls"
import { PanoramaLoading } from "./PanoramaLoading"
import { takeScreenshot, recenterCamera } from "@/lib/panorama"

export interface PanoramaViewerProps {
    open: boolean
    onClose: () => void
    initialImage?: string
}

export function PanoramaViewer({ open, onClose, initialImage }: PanoramaViewerProps) {
    // 状态管理
    const [isLoading, setIsLoading] = React.useState(true)
    const [loadingText, setLoadingText] = React.useState("正在处理全景图...")

    // Three.js 引用
    const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null)
    const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null)
    const sceneRef = React.useRef<THREE.Scene | null>(null)
    const controlsRef = React.useRef<OrbitControls | null>(null)

    // 图片加载完成
    const handleImageLoaded = React.useCallback(() => {
        setIsLoading(false)
    }, [])

    // 图片加载失败
    const handleImageError = React.useCallback(() => {
        setIsLoading(false)
        alert("图片加载失败，请尝试其他图片。")
    }, [])

    // 截图处理
    const handleScreenshotSingle = React.useCallback(() => {
        if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return
        setLoadingText("正在生成截图...")
        setIsLoading(true)

        setTimeout(async () => {
            await takeScreenshot({
                type: "single",
                renderer: rendererRef.current!,
                camera: cameraRef.current!,
                scene: sceneRef.current!,
            })
            setIsLoading(false)
        }, 50)
    }, [])

    const handleScreenshot4 = React.useCallback(() => {
        if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return
        setLoadingText("正在生成截图...")
        setIsLoading(true)

        setTimeout(async () => {
            await takeScreenshot({
                type: "4grid",
                renderer: rendererRef.current!,
                camera: cameraRef.current!,
                scene: sceneRef.current!,
            })
            setIsLoading(false)
        }, 50)
    }, [])

    const handleScreenshot12 = React.useCallback(() => {
        if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return
        setLoadingText("正在生成截图...")
        setIsLoading(true)

        setTimeout(async () => {
            await takeScreenshot({
                type: "12grid",
                renderer: rendererRef.current!,
                camera: cameraRef.current!,
                scene: sceneRef.current!,
            })
            setIsLoading(false)
        }, 50)
    }, [])

    // 重置视角
    const handleRecenter = React.useCallback(() => {
        if (cameraRef.current && controlsRef.current) {
            recenterCamera(cameraRef.current, controlsRef.current)
        }
    }, [])

    if (!open) return null

    return (
        <div id="panorama-root" className="fixed inset-0 z-[100] bg-gray-950 overflow-hidden">
            {/* Three.js 渲染画布 */}
            <PanoramaCanvas
                imageUrl={initialImage || null}
                onImageLoaded={handleImageLoaded}
                onImageError={handleImageError}
                rendererRef={rendererRef}
                cameraRef={cameraRef}
                sceneRef={sceneRef}
                controlsRef={controlsRef}
            />

            {/* 加载中 */}
            {isLoading && <PanoramaLoading text={loadingText} />}

            {/* 控制面板 - 有图片且加载完成后显示 */}
            {!isLoading && initialImage && (
                <>
                    <PanoramaControls
                        onScreenshotSingle={handleScreenshotSingle}
                        onScreenshot4={handleScreenshot4}
                        onScreenshot12={handleScreenshot12}
                        onRecenter={handleRecenter}
                        onChangeImage={onClose}
                    />

                    {/* 关闭按钮 */}
                    <button
                        onClick={onClose}
                        className="fixed top-6 left-6 z-20 glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center"
                        title="关闭"
                    >
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                        关闭
                    </button>
                </>
            )}
        </div>
    )
}
