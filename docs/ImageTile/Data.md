I will provide you with a set of high level, and low level performance data about an interaction in a React App:
### High level
- react component render time: 178ms
- how long it took to run javascript event handlers (EXCLUDING REACT RENDERS): 0ms
- how long it took from the last event handler time, to the last request animation frame: 644ms
	- things like prepaint, style recalculations, layerization, async web API's like observers may occur during this time
- how long it took from the last request animation frame to when the dom was committed: 702ms
	- during this period you will see paint, commit, potential style recalcs, and other misc browser activity. Frequently high times here imply css that makes the browser do a lot of work, or mutating expensive dom properties during the event handler stage. This can be many things, but it narrows the problem scope significantly when this is high
- how long it took from dom commit for the frame to be presented: 0ms. This is when information about how to paint the next frame is sent to the compositor threads, and when the GPU does work. If this is high, look for issues that may be a bottleneck for operations occurring during this time

### Low level
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

