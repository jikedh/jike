I will provide you with a set of high level, and low level performance data about an interaction in a React App:
### High level
- react component render time: 883ms
- how long it took to run javascript event handlers (EXCLUDING REACT RENDERS): 139ms
- how long it took from the last event handler time, to the last request animation frame: 19ms
	- things like prepaint, style recalculations, layerization, async web API's like observers may occur during this time
- how long it took from the last request animation frame to when the dom was committed: 176ms
	- during this period you will see paint, commit, potential style recalcs, and other misc browser activity. Frequently high times here imply css that makes the browser do a lot of work, or mutating expensive dom properties during the event handler stage. This can be many things, but it narrows the problem scope significantly when this is high
- how long it took from dom commit for the frame to be presented: 0ms. This is when information about how to paint the next frame is sent to the compositor threads, and when the GPU does work. If this is high, look for issues that may be a bottleneck for operations occurring during this time

### Low level
We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.
Component Name:CollapsibleImageGallery
Rendered: 42 times
Sum of self times for CollapsibleImageGallery is 160ms
Changed props for all CollapsibleImageGallery instances ("name:count" pairs)
images:42x
frameSize:42x

Component Name:NodeContextMenu
Rendered: 68 times
Sum of self times for NodeContextMenu is 96ms
Changed props for all NodeContextMenu instances ("name:count" pairs)
onCreateAsset:4x

Component Name:ButtonHandle
Rendered: 136 times
Sum of self times for ButtonHandle is 91ms

Component Name:ImageNode
Rendered: 48 times
Sum of self times for ImageNode is 79ms
Changed props for all ImageNode instances ("name:count" pairs)
selected:1x
zIndex:1x

Component Name:Photo
Rendered: 90 times
Sum of self times for Photo is 57ms

Component Name:ContextMenuTrigger
Rendered: 142 times
Sum of self times for ContextMenuTrigger is 29ms

Component Name:ImageTile
Rendered: 135 times
Sum of self times for ImageTile is 25ms

Component Name:BaseHandle
Rendered: 136 times
Sum of self times for BaseHandle is 24ms

Component Name:CanvasFlow
Rendered: 3 times
Sum of self times for CanvasFlow is 23ms
Changed state for all CanvasFlow instances ("hook index:count" pairs)
173:3x

Component Name:ContextMenu
Rendered: 142 times
Sum of self times for ContextMenu is 20ms

Component Name:NodeNameBadge
Rendered: 68 times
Sum of self times for NodeNameBadge is 19ms
Changed props for all NodeNameBadge instances ("name:count" pairs)
icon:68x
onEditEnd:68x

Component Name:Menu
Rendered: 71 times
Sum of self times for Menu is 18ms
Changed props for all Menu instances ("name:count" pairs)
__scopeMenu:71x

Component Name:HandleComponent
Rendered: 272 times
Sum of self times for HandleComponent is 18ms
Changed props for all HandleComponent instances ("name:count" pairs)
style:272x

Component Name:MenuPortal
Rendered: 71 times
Sum of self times for MenuPortal is 15ms
Changed props for all MenuPortal instances ("name:count" pairs)
__scopeMenu:71x

Component Name:Refresh
Rendered: 36 times
Sum of self times for Refresh is 14ms

Component Name:ContextMenuContent
Rendered: 71 times
Sum of self times for ContextMenuContent is 13ms

Component Name:TextAgentNode
Rendered: 20 times
Sum of self times for TextAgentNode is 12ms
Changed state for all TextAgentNode instances ("hook index:count" pairs)
36:20x

Component Name:SettingsModal
Rendered: 1 times
Sum of self times for SettingsModal is 12ms
Changed props for all SettingsModal instances ("name:count" pairs)
onClose:1x

Component Name:MenuProvider
Rendered: 142 times
Sum of self times for MenuProvider is 11ms
Changed props for all MenuProvider instances ("name:count" pairs)
scope:142x

Component Name:ContextMenuProvider
Rendered: 71 times
Sum of self times for ContextMenuProvider is 11ms

Component Name:NodeBody
Rendered: 20 times
Sum of self times for NodeBody is 10ms

Component Name:Primitive.span.Slot
Rendered: 71 times
Sum of self times for Primitive.span.Slot is 9ms
Changed props for all Primitive.span.Slot instances ("name:count" pairs)
style:71x
onContextMenu:71x
onPointerDown:71x
onPointerMove:71x
onPointerCancel:71x
onPointerUp:71x

Component Name:ContextMenuPortal
Rendered: 71 times
Sum of self times for ContextMenuPortal is 7ms

Component Name:MenuAnchor
Rendered: 71 times
Sum of self times for MenuAnchor is 7ms
Changed props for all MenuAnchor instances ("name:count" pairs)
__scopeMenu:71x

Component Name:ChatDrawer
Rendered: 1 times
Sum of self times for ChatDrawer is 6ms
Changed props for all ChatDrawer instances ("name:count" pairs)
onClose:1x
sendMessage:1x
stopMessage:1x
clearLocalMessages:1x

Component Name:Primitive.span
Rendered: 71 times
Sum of self times for Primitive.span is 6ms
Changed props for all Primitive.span instances ("name:count" pairs)
style:71x
onContextMenu:71x
onPointerDown:71x
onPointerMove:71x
onPointerCancel:71x
onPointerUp:71x

Component Name:MenuPortalProvider
Rendered: 71 times
Sum of self times for MenuPortalProvider is 6ms
Changed props for all MenuPortalProvider instances ("name:count" pairs)
scope:71x

Component Name:Popper
Rendered: 71 times
Sum of self times for Popper is 6ms
Changed props for all Popper instances ("name:count" pairs)
__scopePopper:71x

Component Name:_c
Rendered: 48 times
Sum of self times for _c is 6ms
Changed props for all _c instances ("name:count" pairs)
frameSize:48x

Component Name:PopperProvider
Rendered: 71 times
Sum of self times for PopperProvider is 6ms
Changed props for all PopperProvider instances ("name:count" pairs)
scope:71x

