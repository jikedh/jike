"use client"

import * as React from "react"
import { PanoramaViewer } from "@/components/panorama/PanoramaViewer"

export default function PanoramaDemo() {
    const [isOpen, setIsOpen] = React.useState(false)

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">360° 全景浏览器演示</h1>
            
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
                打开全景浏览器
            </button>

            <PanoramaViewer
                open={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </div>
    )
}
