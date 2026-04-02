"use client"

import * as React from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

interface PanoramaCanvasProps {
    imageUrl: string | null
    onImageLoaded?: () => void
    onImageError?: (error: any) => void
    rendererRef?: React.MutableRefObject<THREE.WebGLRenderer | null>
    cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>
    sceneRef?: React.MutableRefObject<THREE.Scene | null>
    controlsRef?: React.MutableRefObject<OrbitControls | null>
}

export function PanoramaCanvas({
    imageUrl,
    onImageLoaded,
    onImageError,
    rendererRef,
    cameraRef,
    sceneRef,
    controlsRef,
}: PanoramaCanvasProps) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const animationFrameRef = React.useRef<number>(0)

    // 初始化 Three.js 场景
    React.useEffect(() => {
        if (!containerRef.current) return

        const container = containerRef.current

        // 创建场景
        const scene = new THREE.Scene()
        if (sceneRef) sceneRef.current = scene

        // 创建相机
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        )
        camera.position.set(0, 0, 0.1)
        if (cameraRef) cameraRef.current = camera

        // 创建渲染器
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
        })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        container.appendChild(renderer.domElement)
        if (rendererRef) rendererRef.current = renderer

        // 创建轨道控制器
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableZoom = true
        controls.enablePan = false
        controls.minDistance = 0.1
        controls.maxDistance = 100
        controls.rotateSpeed = -0.5
        if (controlsRef) controlsRef.current = controls

        // 创建全景球体
        const geometry = new THREE.SphereGeometry(500, 60, 40)
        geometry.scale(-1, 1, 1)

        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 })
        const sphere = new THREE.Mesh(geometry, sphereMaterial)
        scene.add(sphere)

        // 动画循环
        function animate() {
            animationFrameRef.current = requestAnimationFrame(animate)
            controls.update()
            renderer.render(scene, camera)
        }
        animate()

        // 窗口大小变化处理
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight
            camera.updateProjectionMatrix()
            renderer.setSize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener("resize", onWindowResize)

        // 清理函数
        return () => {
            cancelAnimationFrame(animationFrameRef.current)
            window.removeEventListener("resize", onWindowResize)
            geometry.dispose()
            sphereMaterial.dispose()
            if (sphereMaterial.map) sphereMaterial.map.dispose()
            renderer.dispose()
            container.removeChild(renderer.domElement)
        }
    }, [])

    // 加载全景图纹理
    React.useEffect(() => {
        if (!imageUrl || !rendererRef?.current) return

        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(
            imageUrl,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace
                texture.minFilter = THREE.LinearFilter
                texture.magFilter = THREE.LinearFilter

                const renderer = rendererRef.current!
                const scene = sceneRef?.current
                if (!scene) return

                // 查找球体并更新材质
                scene.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        const material = object.material as THREE.MeshBasicMaterial
                        if (material && "map" in material) {
                            material.map = texture
                            material.color.setHex(0xffffff)
                            material.needsUpdate = true
                        }
                    }
                })

                onImageLoaded?.()
            },
            undefined,
            (error) => {
                console.error("全景图加载失败:", error)
                onImageError?.(error)
            }
        )
    }, [imageUrl, onImageLoaded, onImageError])

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-10 cursor-grab"
            style={{ cursor: "grab" }}
        />
    )
}
