You will attempt to implement a performance improvement to a user interaction in a React app. You will be provided with data about the interaction, and the slow down.

Your should split your goals into 2 parts:
- identifying the problem
- fixing the problem
	- it is okay to implement a fix even if you aren't 100% sure the fix solves the performance problem. When you aren't sure, you should tell the user to try repeating the interaction, and feeding the "Formatted Data" in the React Scan notifications optimize tab. This allows you to start a debugging flow with the user, where you attempt a fix, and observe the result. The user may make a mistake when they pass you the formatted data, so must make sure, given the data passed to you, that the associated data ties to the same interaction you were trying to debug.


Make sure to check if the user has the react compiler enabled (project dependent, configured through build tool), so you don't unnecessarily memoize components. If it is, you do not need to worry about memoizing user components

One challenge you may face is the performance problem lies in a node_module, not in user code. If you are confident the problem originates because of a node_module, there are multiple strategies, which are context dependent:
- you can try to work around the problem, knowing which module is slow
- you can determine if its possible to resolve the problem in the node_module by modifying non node_module code
- you can monkey patch the node_module to experiment and see if it's really the problem (you can modify a functions properties to hijack the call for example)
- you can determine if it's feasible to replace whatever node_module is causing the problem with a performant option (this is an extreme)

The interaction was a click on the component named ImageTile. This component has the following ancestors App>AppRouter>DataRouter>DataRouterState>Fetchers>ViewTransition>Navigation>Location>DataRoutes>RenderedRoute>Route>CanvasPage>CanvasFlow>CanvasContextMenu>ContextMenu>ContextMenu>Menu>Popper>ContextMenuTrigger>ContextMenuTrigger>Primitive.span>Primitive.span.Slot>Primitive.span.SlotClone>ReactFlow>Wrapper>GraphView>FlowRenderer>ZoomPane>Pane>Viewport>NodeRenderer>NodeWrapper>ImageNode>NodeContextMenu>ContextMenu>ContextMenu>Menu>Popper>ContextMenuTrigger>ContextMenuTrigger>Primitive.span>Primitive.span.Slot>Primitive.span.SlotClone>CollapsibleImageGallery>ImageTile. This is the path from the component, to the root. This should be enough information to figure out where this component is in the user's code base

This path is the component that was clicked, so it should tell you roughly where component had an event handler that triggered a state change.

Please note that the leaf node of this path might not be user code (if they use a UI library), and they may contain many wrapper components that just pass through children that aren't relevant to the actual click. So make you sure analyze the path and understand what the user code is doing

We have a set of high level, and low level data about the performance issue.

The click took 1525ms from interaction start, to when a new frame was presented to a user.

We also provide you with a breakdown of what the browser spent time on during the period of interaction start to frame presentation.

- react component render time: 178ms
- how long it took to run javascript event handlers (EXCLUDING REACT RENDERS): 0ms
- how long it took from the last event handler time, to the last request animation frame: 644ms
	- things like prepaint, style recalculations, layerization, async web API's like observers may occur during this time
- how long it took from the last request animation frame to when the dom was committed: 702ms
	- during this period you will see paint, commit, potential style recalcs, and other misc browser activity. Frequently high times here imply css that makes the browser do a lot of work, or mutating expensive dom properties during the event handler stage. This can be many things, but it narrows the problem scope significantly when this is high
- how long it took from dom commit for the frame to be presented: 0ms. This is when information about how to paint the next frame is sent to the compositor threads, and when the GPU does work. If this is high, look for issues that may be a bottleneck for operations occurring during this time


We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.

Component Name:EdgeWrapper
Rendered: 150 times
Sum of self times for EdgeWrapper is 44ms
Changed props for all EdgeWrapper instances ("name:count" pairs)
noPanClassName:150x

Component Name:NodeWrapper
Rendered: 111 times
Sum of self times for NodeWrapper is 31ms
Changed state for all NodeWrapper instances ("hook index:count" pairs)
2:4x

Component Name:HandleComponent
Rendered: 214 times
Sum of self times for HandleComponent is 21ms
Changed state for all HandleComponent instances ("hook index:count" pairs)
3:214x

Component Name:CanvasFlow
Rendered: 3 times
Sum of self times for CanvasFlow is 16ms
Changed state for all CanvasFlow instances ("hook index:count" pairs)
173:2x

Component Name:EdgeRenderer
Rendered: 1 times
Sum of self times for EdgeRenderer is 12ms
Changed props for all EdgeRenderer instances ("name:count" pairs)
noPanClassName:1x

Component Name:MiniMap
Rendered: 13 times
Sum of self times for MiniMap is 11ms
Changed state for all MiniMap instances ("hook index:count" pairs)
4:1x

Component Name:NodeRenderer
Rendered: 1 times
Sum of self times for NodeRenderer is 9ms
Changed props for all NodeRenderer instances ("name:count" pairs)
noPanClassName:1x



You may notice components have many renders, but much fewer props/state/context changes. This normally implies most of the components could have been memoized to avoid computation

It's also important to remember if a component had no props/state/context change, and it was memoized, it would not render. So the flow should be:
- find the most expensive components
- see what's causing them to render
- determine how you can make those state/props/context not change for a large set of the renders
- once there are no more changes left, you can memoize the component so it no longer unnecessarily re-renders.

An important thing to note is that if you see a lot of react renders (some components with very high render counts), but javascript excluding renders is much higher than render time, it is possible that the components with lots of renders run hooks like useEffect/useLayoutEffect, which run during the JS event handler period.

It's also good to note that react profiles hook times in development, and if many hooks are called (lets say 5,000 components all called a useEffect), it will have to profile every single one. And it may also be the case the comparison of the hooks dependency can be expensive, and that would not be tracked in render time.

If a node_module is the component with high renders, you can experiment to see if that component is the root issue (because of hooks). You should use the same instructions for node_module debugging mentioned previously.

