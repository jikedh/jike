import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { toast } from 'sonner'

import { FloatingSidebar } from './FloatingSidebar'
import type { FloatingSidebarProps } from './FloatingSidebar'
import { assistantActionToPresetId } from '../constants/canvasConfig'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { AllNodeType, EdgeType } from '@/types/flow'

export const CanvasSidebar = () => {
    const addNode = useCanvasFlowStore((state) => state.addNode)
    const saveGraph = useCanvasFlowStore((state) => state.saveGraph)
    const resetToSavedGraph = useCanvasFlowStore((state) => state.resetToSavedGraph)
    const { screenToFlowPosition } = useReactFlow<AllNodeType, EdgeType>()

    const handleSidebarAction = useCallback<NonNullable<FloatingSidebarProps['onAction']>>(
        (actionId) => {
            const centerFlowPosition = screenToFlowPosition({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
            })

            switch (actionId) {
                case 'create-note':
                    addNode('note', centerFlowPosition)
                    break
                case 'create-image':
                    addNode('image', centerFlowPosition)
                    break
                case 'create-video':
                    addNode('video', centerFlowPosition)
                    break
                case 'create-audio':
                    addNode('audio', centerFlowPosition)
                    break
                case 'save':
                    saveGraph()
                    toast.success('画布已保存')
                    break
                case 'reset':
                    resetToSavedGraph()
                    toast.info('画布已重置')
                    break
                default:
                    if (assistantActionToPresetId[actionId]) {
                        addNode('agent', centerFlowPosition, {
                            agentPresetId: assistantActionToPresetId[actionId],
                        })
                    }
                    break
            }
        },
        [addNode, saveGraph, resetToSavedGraph, screenToFlowPosition]
    )

    return <FloatingSidebar onAction={handleSidebarAction} />
}
