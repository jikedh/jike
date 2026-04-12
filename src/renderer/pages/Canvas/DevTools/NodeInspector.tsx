import { type Node, useNodes, ViewportPortal } from "@xyflow/react";

type NodeInfoProps = {
  node: Node;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

function NodeInfo({ node, x, y, width, height }: NodeInfoProps) {
  if (!width || !height) {
    return null;
  }

  return (
    <div
      className="react-flow__devtools-nodeinfo"
      style={{
        position: "absolute",
        transform: `translate(${x}px, ${y + height}px)`,
      }}
    >
      <div className="node-info-header">
        <span className="node-info-id">{node.id}</span>
        <span className="node-info-type">{node.type || "default"}</span>
      </div>
      <div className="node-info-content">
        <pre>{JSON.stringify(node, null, 2)}</pre>
      </div>
    </div>
  );
}

export default function NodeInspector() {
  const nodes = useNodes();

  return (
    <ViewportPortal>
      <div className="react-flow__devtools-nodeinspector">
        {nodes.map((node) => {
          const x = node?.position?.x || 0;
          const y = node?.position?.y || 0;
          const width = node.measured?.width || 0;
          const height = node.measured?.height || 0;

          return (
            <NodeInfo
              key={node.id}
              node={node}
              x={x}
              y={y}
              width={width}
              height={height}
            />
          );
        })}
      </div>
    </ViewportPortal>
  );
}
