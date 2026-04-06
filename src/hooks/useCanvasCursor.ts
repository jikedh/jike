import { useEffect, useState } from 'react'

type CursorMode = 'default' | 'pointer' | 'grabbing' | 'zoom-in'

export function useCanvasCursor() {
    const [cursorMode, setCursorMode] = useState<CursorMode>('default')
    const [isSpacePressed, setIsSpacePressed] = useState(false)

    useEffect(() => {
        let spacePressed = false
        let isCtrlPressed = false

        const updateCursorMode = () => {
            if (spacePressed) {
                setCursorMode('grabbing')
            } else if (isCtrlPressed) {
                setCursorMode('zoom-in')
            } else {
                setCursorMode('default')
            }
            setIsSpacePressed(spacePressed)
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space' && !event.repeat) {
                event.preventDefault()
                spacePressed = true
                updateCursorMode()
            } else if ((event.ctrlKey || event.metaKey) && !isCtrlPressed) {
                isCtrlPressed = true
                updateCursorMode()
            }
        }

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                spacePressed = false
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
        isSpacePressed,
    }
}