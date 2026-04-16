import { Panel, PanelPosition } from "@xyflow/react";
import {
  type Dispatch,
  HTMLAttributes,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";
import ChangeLogger from "./ChangeLogger";
import MessageDemo from "./MessageDemo";
import NodeInspector from "./NodeInspector";

import "./style.css";

export default function ReactFlowDevTools({
  position = "top-center",
}: {
  position?: PanelPosition;
}) {
  const [nodeInspectorActive, setNodeInspectorActive] = useState(false);
  const [changeLoggerActive, setChangeLoggerActive] = useState(false);
  const [messageDemoActive, setMessageDemoActive] = useState(false);

  return (
    <div className="react-flow__devtools">
      <Panel position={position}>
        <DevToolButton
          setActive={setNodeInspectorActive}
          active={nodeInspectorActive}
          title="Toggle Node Inspector"
        >
          Node Inspector
        </DevToolButton>
        <DevToolButton
          setActive={setChangeLoggerActive}
          active={changeLoggerActive}
          title="Toggle Change Logger"
        >
          Change Logger
        </DevToolButton>
        <DevToolButton
          setActive={setMessageDemoActive}
          active={messageDemoActive}
          title="Toggle Message Demo"
        >
          Message Demo
        </DevToolButton>
      </Panel>
      {changeLoggerActive && <ChangeLogger />}
      {nodeInspectorActive && <NodeInspector />}
      {messageDemoActive && <MessageDemo />}
    </div>
  );
}

function DevToolButton({
  active,
  setActive,
  children,
  ...rest
}: {
  active: boolean;
  setActive: Dispatch<SetStateAction<boolean>>;
  children: ReactNode;
} & HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={() => setActive((a) => !a)}
      className={active ? "active" : ""}
      {...rest}
    >
      {children}
    </button>
  );
}
