/**
 * 短片合成页面（占位）
 *
 * 该模块原为 Agnes-Video-V2.0 接入 Demo，已下线。
 * 后续短片合成功能正在开发中。
 */
import { Clapperboard } from "lucide-react";

export default function VideoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#B43FEB] to-[#5C2EBE]">
          <Clapperboard className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold">短片合成</h1>
        <p className="text-sm text-white/50">功能正在开发中，敬请期待</p>
      </div>
    </div>
  );
}
