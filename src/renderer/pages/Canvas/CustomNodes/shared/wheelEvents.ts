import type { WheelEventHandler } from "react";

export const handlePromptEditorWheelCapture: WheelEventHandler<HTMLElement> = (
  event,
) => {
  if (event.ctrlKey || event.metaKey) {
    return;
  }

  event.stopPropagation();
};
