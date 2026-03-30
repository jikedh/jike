import { Position, type HandleProps } from "@xyflow/react";
import { BaseHandle } from "@/components/base-handle";

const wrapperClassNames: Record<Position, string> = {
  [Position.Top]:
    "flex-col-reverse left-1/2 -translate-y-[calc(100%-1px)] -translate-x-1/2",
  [Position.Bottom]: "flex-col left-1/2 translate-y-[1px] -translate-x-1/2 mt-1.5",
  [Position.Left]:
    "flex-row-reverse top-1/2 -translate-x-[calc(100%-1px)] -translate-y-1/2",
  [Position.Right]: "top-1/2 -translate-y-1/2 translate-x-[1px] ",
};

export function ButtonHandle({
  showButton = false,
  visible,
  position = Position.Bottom,
  children,
  ...props
}: HandleProps & {
  showButton?: boolean;
    visible?: boolean;
}) {
  const shouldShow = visible ?? showButton;
  const wrapperClassName = wrapperClassNames[position || Position.Bottom];
  // TODO 后续这里的图标替换，不要写成DIV了，写成真正的图标组件，然后应该有两个
  // 拖动创建节点应该是有冗余的代码的，后续移除一个，只保留一个
  return (
    <BaseHandle position={position} id={props.id} {...props}>
      {shouldShow && (
        <div
          className={`absolute flex items-center ${wrapperClassName} pointer-events-none`}
        >
          <div className="nodrag nopan pointer-events-none">
            {children ?? (
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-600 shadow-sm">
                +
              </div>
            )}
          </div>
        </div>
      )}
    </BaseHandle>
  );
}
