import { useEffect, useState } from 'react'

type CursorMode = 'default' | 'pointer' | 'grabbing' | 'zoom-in'

export function useCanvasCursor() {
    const [cursorMode, setCursorMode] = useState<CursorMode>('default')

    useEffect(() => {
        let isSpacePressed = false
        let isCtrlPressed = false

        const updateCursorMode = () => {
            if (isSpacePressed) {
                setCursorMode('grabbing')
            } else if (isCtrlPressed) {
                setCursorMode('zoom-in')
            } else {
                setCursorMode('default')
            }
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space' && !event.repeat) {
                event.preventDefault()
                isSpacePressed = true
                updateCursorMode()
            } else if ((event.ctrlKey || event.metaKey) && !isCtrlPressed) {
                isCtrlPressed = true
                updateCursorMode()
            }
        }

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                isSpacePressed = false
                updateCursorMode()
            } else if (event.key === 'Control' || event.key === 'Meta') {
                isCtrlPressed = false
                updateCursorMode()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    const getCursorClass = () => {
        switch (cursorMode) {
            case 'pointer':
                return 'canvas-cursor-pointer'
            case 'grabbing':
                return 'canvas-cursor-grabbing'
            case 'zoom-in':
                return 'canvas-cursor-zoom-in'
            default:
                return 'canvas-cursor-default'
        }
    }

    return {
        cursorMode,
        setCursorMode,
        cursorClass: getCursorClass(),
        isCtrlPressed: cursorMode === 'zoom-in',
    }
}