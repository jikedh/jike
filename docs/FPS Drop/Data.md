I will provide you with a set of high level, and low level performance data about a large frame drop in a React App:
### High level
- react component render time: 30ms
- how long it took to run everything else (other JavaScript, hooks like useEffect, style recalculations, layerization, paint & commit and everything else the browser might do to draw a new frame after javascript mutates the DOM): 206.19999998807907ms

### Low level
We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.
Component Name:CanvasFlow
Rendered: 1 times
Sum of self times for CanvasFlow is 6ms
Changed state for all CanvasFlow instances ("hook index:count" pairs)
222:1x

