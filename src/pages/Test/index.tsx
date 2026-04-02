export default function TestPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,240,255,0.08)_0%,transparent_60%)]" />
      </div>

      <main className="flex-1 overflow-y-auto scroll-smooth p-8">
        <div className="flex justify-between items-center mb-8 border-b border-white/[0.08] pb-4">
          <h1 className="text-2xl font-semibold tracking-wider text-white/80 uppercase">
            TEST // 测试页面
          </h1>
        </div>

        <div className="max-w-4xl mx-auto">
          <video
            src="https://files.toapis.com/images/cgt-20260403011807-grmfr/1775150332_d1a4021f.mp4"
            controls
            autoPlay
            className="w-full rounded-lg"
          />
        </div>
      </main>
    </div>
  )
}
