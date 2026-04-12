import { memo } from "react";
import type { XxxGenerationNode } from "shared/types/flow";
import { cn } from "shared/utils/utils";

interface XxxContentProps {
  data: XxxGenerationNode;
}

const XxxContent = memo(function XxxContent({ data }: XxxContentProps) {
  const hasResult = data.result?.data?.length > 0;

  if (hasResult) {
    return (
      <div className="px-3 py-2">
        {/* 展示生成结果 */}
        {data.result?.data.map((item, index) => (
          <div key={index}>{/* 结果内容 */}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 py-8 text-center text-white/50 text-sm">
      暂无内容
    </div>
  );
});

export { XxxContent };
