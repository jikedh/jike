import { useCallback, useEffect, useMemo, useState } from "react";
import type { Adobe2ApiState } from "shared/types/adobe2api";

const POLL_INTERVAL_MS = 3000;

const statusMeta: Record<
  Adobe2ApiState["status"],
  { label: string; className: string; description: string }
> = {
  stopped: {
    label: "未启动",
    className: "bg-zinc-700/60 text-zinc-100",
    description: "服务当前没有运行，可以点击启动。",
  },
  starting: {
    label: "启动中",
    className: "bg-amber-500/20 text-amber-200",
    description: "正在拉起本地 Adobe2API 服务并等待健康检查。",
  },
  running: {
    label: "运行中",
    className: "bg-emerald-500/20 text-emerald-200",
    description: "本地 Adobe2API 管理页和生成接口已经可用。",
  },
  error: {
    label: "错误",
    className: "bg-red-500/20 text-red-200",
    description: "启动失败或健康检查异常，请查看下方日志。",
  },
};

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-sm text-zinc-400 xl:min-h-0">
      启动本地服务后，这里会内嵌 Adobe2API 管理页面。
    </div>
  );
}

export default function SettingsPage() {
  const [state, setState] = useState<Adobe2ApiState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [hostInput, setHostInput] = useState("127.0.0.1");
  const [portInput, setPortInput] = useState("18000");
  const [outputDirInput, setOutputDirInput] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [embeddedPage, setEmbeddedPage] = useState<"manage" | "test">("manage");

  const refreshState = useCallback(async () => {
    try {
      const next = await window.adobe2api.getState();
      setState(next);
      setHostInput(next.settings.host);
      setPortInput(String(next.settings.port));
      setOutputDirInput(next.settings.outputDir || "");
      setPageError(null);
    } catch (error: any) {
      setPageError(error?.message || "读取本地 Adobe2API 状态失败");
    }
  }, []);

  useEffect(() => {
    void refreshState();
    const timer = window.setInterval(() => {
      void refreshState();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshState]);

  const runAction = useCallback(
    async (action: "start" | "stop" | "restart") => {
      try {
        setBusyAction(action);
        setPageError(null);
        const next =
          action === "start"
            ? await window.adobe2api.start()
            : action === "stop"
              ? await window.adobe2api.stop()
              : await window.adobe2api.restart();
        setState(next);
      } catch (error: any) {
        setPageError(error?.message || "服务操作失败");
        await refreshState();
      } finally {
        setBusyAction(null);
      }
    },
    [refreshState],
  );

  const saveSettings = useCallback(async () => {
    try {
      setBusyAction("save");
      const next = await window.adobe2api.updateSettings({
        host: hostInput.trim(),
        port: Number(portInput),
        outputDir: outputDirInput.trim() || null,
      });
      setState(next);
      setPageError(null);
    } catch (error: any) {
      setPageError(error?.message || "保存配置失败");
    } finally {
      setBusyAction(null);
    }
  }, [hostInput, outputDirInput, portInput]);

  const selectOutputDir = useCallback(async () => {
    try {
      setBusyAction("pick-output");
      const selected = await window.adobe2api.selectOutputDirectory();
      if (selected) {
        setOutputDirInput(selected);
      }
    } catch (error: any) {
      setPageError(error?.message || "选择结果目录失败");
    } finally {
      setBusyAction(null);
    }
  }, []);

  const openAdminWindow = useCallback(async () => {
    try {
      setBusyAction("open-admin");
      setPageError(null);
      const next = await window.adobe2api.openAdminWindow();
      setState(next);
    } catch (error: any) {
      setPageError(error?.message || "打开 Adobe2API 管理后台失败");
    } finally {
      setBusyAction(null);
    }
  }, []);

  const logs = useMemo(() => state?.recentLogs ?? [], [state]);
  const meta = statusMeta[state?.status || "stopped"];
  const embeddedUrl =
    embeddedPage === "manage"
      ? (state?.manageUrl ?? "")
      : (state?.testUrl ?? "");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">本地 Adobe2API 渠道</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Electron 负责托管本地 Adobe2API 服务，并在设置页内嵌现有管理页面。
            </p>
          </div>
          <div
            className={`rounded-full px-4 py-2 text-sm font-medium ${meta.className}`}
          >
            {meta.label}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-medium">服务控制</h2>
              <p className="mt-2 text-sm text-zinc-400">{meta.description}</p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-black/20 p-3">
                  <div className="text-zinc-500">访问地址</div>
                  <div className="mt-1 break-all text-zinc-100">
                    {state?.baseUrl || `http://${hostInput}:${portInput}`}
                  </div>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <div className="text-zinc-500">数据目录</div>
                  <div className="mt-1 break-all text-zinc-100">
                    {state?.dataDir || "-"}
                  </div>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <div className="text-zinc-500">日志文件</div>
                  <div className="mt-1 break-all text-zinc-100">
                    {state?.logPath || "-"}
                  </div>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <div className="text-zinc-500">进程 PID</div>
                  <div className="mt-1 text-zinc-100">{state?.pid ?? "-"}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void runAction("start")}
                  disabled={busyAction !== null || state?.status === "running"}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  启动服务
                </button>
                <button
                  type="button"
                  onClick={() => void runAction("restart")}
                  disabled={busyAction !== null || !state}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  重启服务
                </button>
                <button
                  type="button"
                  onClick={() => void runAction("stop")}
                  disabled={busyAction !== null || state?.status === "stopped"}
                  className="rounded-xl bg-red-500/80 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  停止服务
                </button>
              </div>

              {pageError ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {pageError}
                </div>
              ) : null}
              {state?.lastError ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  最近错误：{state.lastError}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-medium">运行配置</h2>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <div className="mb-2 text-sm text-zinc-400">Host</div>
                  <input
                    value={hostInput}
                    onChange={(event) => setHostInput(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm text-zinc-400">Port</div>
                  <input
                    value={portInput}
                    onChange={(event) => setPortInput(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm text-zinc-400">结果目录</div>
                  <div className="flex gap-2">
                    <input
                      value={outputDirInput}
                      onChange={(event) =>
                        setOutputDirInput(event.target.value)
                      }
                      placeholder="选择后，生成结果会自动复制到该目录"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void selectOutputDir()}
                      disabled={busyAction !== null}
                      className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      选择目录
                    </button>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={busyAction !== null}
                  className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  保存配置
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-medium">启动日志</h2>
              <div className="mt-4 max-h-[320px] overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-zinc-300">
                {logs.length > 0 ? logs.join("\n") : "暂无日志"}
              </div>
            </section>
          </div>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 xl:h-[calc(100vh-160px)]">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">内嵌管理页</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  当前直接复用 Adobe2API
                  现有管理/测试页面，后续再决定是否替换为原生界面。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-black/20 p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setEmbeddedPage("manage")}
                    className={`rounded-lg px-3 py-2 ${
                      embeddedPage === "manage"
                        ? "bg-white text-black"
                        : "text-zinc-300"
                    }`}
                  >
                    管理页
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmbeddedPage("test")}
                    className={`rounded-lg px-3 py-2 ${
                      embeddedPage === "test"
                        ? "bg-white text-black"
                        : "text-zinc-300"
                    }`}
                  >
                    测试页
                  </button>
                </div>
                {state?.status === "running" ? (
                  <button
                    type="button"
                    onClick={() => void openAdminWindow()}
                    disabled={busyAction !== null}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm"
                  >
                    应用内打开
                  </button>
                ) : null}
              </div>
            </div>

            {state?.status === "running" ? (
              <iframe
                title={
                  embeddedPage === "manage"
                    ? "Adobe2API 管理页面"
                    : "Adobe2API 测试页面"
                }
                src={embeddedUrl}
                className="min-h-[360px] w-full flex-1 rounded-xl bg-white xl:min-h-0"
              />
            ) : (
              <EmptyState />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
