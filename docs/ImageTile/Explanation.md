Your goal will be to help me find the source of a performance problem. I collected a large dataset about this specific performance problem.

There was a click on a component named ImageTile. This means, roughly, the component that handled the click event was named ImageTile.

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

It's also important to remember if a component had no props/state/context change, and it was memoized, it would not render. So a flow we can go through is:
- find the most expensive components
- see what's causing them to render
- determine how you can make those state/props/context not change for a large set of the renders
- once there are no more changes left, you can memoize the component so it no longer unnecessarily re-renders.


An important thing to note is that if you see a lot of react renders (some components with very high render counts), but javascript excluding renders is much higher than render time, it is possible that the components with lots of renders run hooks like useEffect/useLayoutEffect, which run during the JS event handler period.

It's also good to note that react profiles hook times in development, and if many hooks are called (lets say 5,000 components all called a useEffect), it will have to profile every single one. And it may also be the case the comparison of the hooks dependency can be expensive, and that would not be tracked in render time.

If it's not possible to explain the root problem from this data, please ask me for more data explicitly, and what we would need to know to find the source of the performance problem.
