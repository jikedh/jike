import { useEffect, useRef } from "react";
import { Position, type HandleProps } from "@xyflow/react";
import { BaseHandle } from "@/components/base-handle";

const wrapperClassNames: Record<Position, string> = {
  [Position.Top]:
    "flex-col-reverse left-1/2 -translate-y-[calc(100%-1px)] -translate-x-1/2",
  [Position.Bottom]:
    "flex-col left-1/2 translate-y-[1px] -translate-x-1/2 mt-1.5",
  [Position.Left]:
    "flex-row-reverse top-1/2 -translate-x-[calc(100%-1px)] -translate-y-1/2",
  [Position.Right]: "top-1/2 -translate-y-1/2 translate-x-[1px] ",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function ButtonHandle({
  showButton = false,
  visible,
  position = Position.Bottom,
  followAreaSize = 100,
  buttonSize = 28,
  children,
  ...props
}: HandleProps & {
  showButton?: boolean;
  visible?: boolean;
  followAreaSize?: number;
  buttonSize?: number;
}) {
  const shouldShow = visible ?? showButton;
  const wrapperClassName = wrapperClassNames[position || Position.Bottom];
  const followAreaRef = useRef<any>(null);
  const pendingPointerRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);

  const flushPointerPosition = () => {
    frameRef.current = null;

    const area = followAreaRef.current;
    const pointer = pendingPointerRef.current;
    if (!area || !pointer) {
      return;
    }

    const rect = area.getBoundingClientRect();
    const halfButton = buttonSize / 2;
    const scaleX = rect.width > 0 ? rect.width / followAreaSize : 1;
    const scaleY = rect.height > 0 ? rect.height / followAreaSize : 1;

    const centerX = clamp(
      (pointer.x - rect.left) / scaleX,
      halfButton,
      followAreaSize - halfButton,
    );
    const centerY = clamp(
      (pointer.y - rect.top) / scaleY,
      halfButton,
      followAreaSize - halfButton,
    );

    area.style.setProperty("--btn-x", `${Math.round(centerX)}px`);
    area.style.setProperty("--btn-y", `${Math.round(centerY)}px`);
  };

  const handlePointerMove = (event: any) => {
    pendingPointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(flushPointerPosition);
  };

  const handlePointerLeave = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    pendingPointerRef.current = null;

    const area = followAreaRef.current;
    if (area) {
      area.style.removeProperty("--btn-x");
      area.style.removeProperty("--btn-y");
    }
  };

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  // TODO 后续这里的图标替换，不要写成DIV了，写成真正的图标组件，然后应该有两个
  // 拖动创建节点应该是有冗余的代码的，后续移除一个，只保留一个
  return (
    <BaseHandle position={position} id={props.id} {...props}>
      {shouldShow && (
        <div
          className={`absolute flex items-center ${wrapperClassName} pointer-events-none`}
        >
          <div
            ref={followAreaRef}
            className="relative nodrag nopan pointer-events-auto rounded-md bg-transparent"
            style={{
              width: followAreaSize,
              height: followAreaSize,
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            <div
              className="pointer-events-none absolute flex items-center justify-center"
              style={{
                width: buttonSize,
                height: buttonSize,
                left: "var(--btn-x, 50%)",
                top: "var(--btn-y, 50%)",
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="nodrag nopan pointer-events-none">
                {children ?? (
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#B43FEB]/50 bg-[#1a1a1f] text-sm font-medium text-[#B43FEB] shadow-lg hover:border-[#B43FEB] hover:bg-[#B43FEB]/10 transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseHandle>
  );
}
