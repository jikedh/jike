Your goal will be to help me find the source of a performance problem. I collected a large dataset about this specific performance problem.

There was a click on a component named Pane. This means, roughly, the component that handled the click event was named Pane.

We have a set of high level, and low level data about the performance issue.

The click took 1217ms from interaction start, to when a new frame was presented to a user.

We also provide you with a breakdown of what the browser spent time on during the period of interaction start to frame presentation.

- react component render time: 883ms
- how long it took to run javascript event handlers (EXCLUDING REACT RENDERS): 139ms
- how long it took from the last event handler time, to the last request animation frame: 19ms
	- things like prepaint, style recalculations, layerization, async web API's like observers may occur during this time
- how long it took from the last request animation frame to when the dom was committed: 176ms
	- during this period you will see paint, commit, potential style recalcs, and other misc browser activity. Frequently high times here imply css that makes the browser do a lot of work, or mutating expensive dom properties during the event handler stage. This can be many things, but it narrows the problem scope significantly when this is high
- how long it took from dom commit for the frame to be presented: 0ms. This is when information about how to paint the next frame is sent to the compositor threads, and when the GPU does work. If this is high, look for issues that may be a bottleneck for operations occurring during this time

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




You may notice components have many renders, but much fewer props/state/context changes. This normally implies most of the components could have been memoized to avoid computation

It's also important to remember if a component had no props/state/context change, and it was memoized, it would not render. So a flow we can go through is:
- find the most expensive components
- see what's causing them to render
- determine how you can make those state/props/context not change for a large set of the renders
- once there are no more changes left, you can memoize the component so it no longer unnecessarily re-renders.


An important thing to note is that if you see a lot of react renders (some components with very high render counts), but javascript excluding renders is much higher than render time, it is possible that the components with lots of renders run hooks like useEffect/useLayoutEffect, which run during the JS event handler period.

It's also good to note that react profiles hook times in development, and if many hooks are called (lets say 5,000 components all called a useEffect), it will have to profile every single one. And it may also be the case the comparison of the hooks dependency can be expensive, and that would not be tracked in render time.

If it's not possible to explain the root problem from this data, please ask me for more data explicitly, and what we would need to know to find the source of the performance problem.
