export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-semibold">模型管理</h1>
        <p className="text-sm text-zinc-400">
          本地模型服务管理已移除。请在画布内打开设置弹窗配置当前可用的模型渠道。
        </p>
      </div>
    </div>
  );
}
