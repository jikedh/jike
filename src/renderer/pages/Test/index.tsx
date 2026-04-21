// 积分 API 测试 Demo 页面
// 用于测试 jikeing.ts 和 manager/score.ts 中的各个接口

import { useState } from "react";
import { getJikeingUserId } from "shared/utils/utils";
import { createDashscopeChatCompletion } from "@/api/ai";
import QRCode from "qrcode";
import {
  createRechargeOrder,
  dailyResign,
  getBalanceInfo,
  getRechargeOrderStatus,
  getScoreConfig,
  initScore,
  innerAddUserScore,
  updateVipScore,
} from "@/api/jikeing";
import {
  addScore,
  adminGetScoreConfig,
  getUserScore,
} from "@/api/manager/score";
import { useUserStore } from "@/stores/useUserStore";

// ===================== 测试按钮组件 =====================

interface TestButtonProps {
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: "default" | "outline" | "ghost";
}

const TestButton = ({
  label,
  onClick,
  loading,
  variant = "default",
}: TestButtonProps) => {
  const baseClasses =
    "px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50";
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-white/20 text-white/80 hover:bg-white/10",
    ghost: "text-white/60 hover:text-white hover:bg-white/5",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "加载中..." : label}
    </button>
  );
};

// ===================== 日志显示组件 =====================

interface LogEntry {
  time: string;
  api: string;
  status: "success" | "error";
  data: any;
}

const LogPanel = ({ logs }: { logs: LogEntry[] }) => {
  return (
    <div className="bg-black/40 rounded-lg border border-white/10 p-4 h-100 overflow-y-auto">
      <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">
        控制台日志
      </h3>
      {logs.length === 0 ? (
        <p className="text-white/30 text-sm">暂无日志，点击按钮开始测试...</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`text-xs p-2 rounded ${log.status === "success"
                ? "bg-green-900/30 text-green-300"
                : "bg-red-900/30 text-red-300"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="opacity-60">{log.time}</span>
                <span className="font-semibold">{log.api}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${log.status === "success"
                    ? "bg-green-800/50"
                    : "bg-red-800/50"
                    }`}
                >
                  {log.status === "success" ? "SUCCESS" : "ERROR"}
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===================== 主组件 =====================

export default function TestPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // 添加日志
  const addLog = (api: string, status: "success" | "error", data: any) => {
    const now = new Date();
    const time = now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [{ time, api, status, data }, ...prev]);
  };

  // 执行 API 调用
  const callApi = async (apiName: string, apiFunc: () => Promise<any>) => {
    setLoadingMap((prev) => ({ ...prev, [apiName]: true }));
    try {
      const response = await apiFunc();
      addLog(apiName, "success", response);
      return response;
    } catch (error: any) {
      console.error(`[${apiName}] 错误:`, error);
      addLog(apiName, "error", error?.response?.data || error.message || error);
      throw error;
    } finally {
      setLoadingMap((prev) => ({ ...prev, [apiName]: false }));
    }
  };

  // ===================== 用户侧 API =====================

  const handleDailyResign = () =>
    callApi("dailyResign (每日签到)", dailyResign);
  const handleInitScore = () => callApi("initScore (初始化积分)", initScore);
  const handleGetScoreConfig = () =>
    callApi("getScoreConfig (获取积分配置)", getScoreConfig);
  const handleGetBalanceInfo = () =>
    callApi("getBalanceInfo (获取积分余额)", getBalanceInfo);

  const [vipScoreData, setVipScoreData] = useState({
    userId: "",
    vipScoreDelta: 0,
  });

  const handleUpdateVipScore = async () => {
    const loginUserId = getJikeingUserId();
    const reqUserId = vipScoreData.userId || loginUserId;

    if (!reqUserId) {
      alert("请先登录并确保存在用户 ID");
      return;
    }

    await callApi("updateVipScore (更新会员积分)", async () => {
      const res = await updateVipScore({
        userId: reqUserId,
        vipScoreDelta: Number(vipScoreData.vipScoreDelta),
      });

      if (res?.code === 10000 || res?.code === 200) {
        await useUserStore.getState().fetchBalanceInfo();
      }

      return res;
    });
  };

  // ===================== 管理侧 API =====================

  const [uuidInput, setUuidInput] = useState("");
  const [adminScoreData, setAdminScoreData] = useState({
    toUserId: "",
    score: 0,
  });

  const handleAdminAddScore = () => {
    if (!adminScoreData.toUserId) {
      alert("请输入用户 ID");
      return;
    }
    callApi("adminAddScore (管理员加积分)", () => addScore(adminScoreData));
  };

  const handleGetUserScoreByUuid = () => {
    if (!uuidInput) {
      alert("请输入 UUID");
      return;
    }
    callApi("getUserScoreByUuid (查询用户积分)", () =>
      getUserScore({ uuid: uuidInput }),
    );
  };

  const handleAdminGetScoreConfig = () =>
    callApi("adminGetScoreConfig (管理员获取配置)", () =>
      adminGetScoreConfig(),
    );

  // ===================== 内部接口 =====================

  const [innerScoreData, setInnerScoreData] = useState({
    userId: "",
    score: 0,
  });

  const handleInnerAddUserScore = () => {
    if (!innerScoreData.userId) {
      alert("请输入用户 ID");
      return;
    }
    callApi("innerAddUserScore (内部加积分)", () =>
      innerAddUserScore(innerScoreData),
    );
  };

  // ===================== 充值订单 API =====================

  const [rechargeData, setRechargeData] = useState({
    userId: "",
    packageId: "",
  });
  const [lastOrderId, setLastOrderId] = useState("");
  const [orderStatus, setOrderStatus] = useState<any>(null);
  const [codeUrl, setCodeUrl] = useState(""); // 微信支付二维码
  const [showQRModal, setShowQRModal] = useState(false); // 弹窗显示
  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(""); // 生成的二维码图片 Data URL
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // 使用 qrcode 库生成二维码图片
  const generateQRCode = async (url: string) => {
    setIsGeneratingQR(true);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error("生成二维码失败:", error);
      addLog("generateQRCode (生成二维码)", "error", error);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // 清理轮询定时器
  const clearPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    setIsPolling(false);
  };

  // 停止轮询并关闭弹窗
  const stopPollingAndClose = () => {
    clearPolling();
    setShowQRModal(false);
  };

  // 轮询查询订单状态
  const startPollingOrderStatus = (orderId: string) => {
    clearPolling();
    setIsPolling(true);

    const timer = setInterval(async () => {
      try {
        const res = await getRechargeOrderStatus(orderId);
        setOrderStatus(res);
        addLog("getRechargeOrderStatus (轮询查询)", "success", res);

        // 检查支付状态 - 根据实际接口返回调整判断条件
        if (res?.data?.status === "PAID" || res?.code === 200) {
          clearPolling();
          setShowQRModal(false);
          alert("🎉 充值成功！积分已到账");
        }
      } catch (error: any) {
        addLog("getRechargeOrderStatus (轮询查询)", "error", error?.message || error);
      }
    }, 3000); // 每 3 秒轮询

    setPollingTimer(timer);
  };

  const handleCreateRechargeOrder = () => {
    const loginUserId = getJikeingUserId();
    const reqUserId = rechargeData.userId || loginUserId;

    if (!reqUserId) {
      alert("请先登录并确保存在用户 ID");
      return;
    }
    if (!rechargeData.packageId) {
      alert("请输入套餐 ID (packageId)");
      return;
    }

    // 清空之前的状态
    setCodeUrl("");
    setOrderStatus(null);
    clearPolling();

    callApi("createRechargeOrder (创建充值订单)", () =>
      createRechargeOrder({
        userId: reqUserId,
        packageId: rechargeData.packageId,
      }),
    ).then((res: any) => {
      // 优先从 response 结构中取 codeUrl
      const url = res?.data?.codeUrl || res?.codeUrl;
      console.log("订单创建成功，codeUrl:", url, "完整响应:", res);
      if (url) {
        setCodeUrl(url);
        setShowQRModal(true);
        // 使用 qrcode 库生成二维码图片
        generateQRCode(url);
      }

      if (res?.data?.orderId) {
        setLastOrderId(res.data.orderId);
        // 开始轮询订单状态
        startPollingOrderStatus(res.data.orderId);
      }
    });
  };

  const handleGetRechargeOrderStatus = () => {
    const orderId = lastOrderId;
    if (!orderId) {
      alert("请先创建订单");
      return;
    }

    callApi("getRechargeOrderStatus (查询订单状态)", () =>
      getRechargeOrderStatus(orderId),
    ).then((res: any) => {
      setOrderStatus(res);
    });
  };

  // ===================== 阿里云百炼 API =====================

  const [dashscopeModel, setDashscopeModel] = useState("qwen-turbo");
  const [dashscopeMessage, setDashscopeMessage] = useState(
    "你好，介绍一下你自己",
  );
  const [dashscopeStream, setDashscopeStream] = useState(false);
  const [dashscopeResult, setDashscopeResult] = useState("");
  const [dashscopeLoading, setDashscopeLoading] = useState(false);
  const [dashscopeAbortController, setDashscopeAbortController] =
    useState<AbortController | null>(null);

  const handleDashscopeChat = async () => {
    if (!dashscopeMessage.trim()) {
      alert("请输入消息内容");
      return;
    }

    setDashscopeResult("");
    setDashscopeLoading(true);
    const controller = new AbortController();
    setDashscopeAbortController(controller);

    try {
      const data = {
        model: dashscopeModel,
        messages: [{ role: "user", content: dashscopeMessage }],
        stream: dashscopeStream,
      };

      if (dashscopeStream) {
        // 流式响应
        const streamGenerator = await createDashscopeChatCompletion(
          data,
          controller.signal,
        );
        for await (const chunk of streamGenerator) {
          setDashscopeResult((prev) => prev + (chunk.content || ""));
        }
      } else {
        // 非流式响应
        const response = await createDashscopeChatCompletion(
          data,
          controller.signal,
        );
        setDashscopeResult(JSON.stringify(response, null, 2));
        addLog("createDashscopeChatCompletion (百炼对话)", "success", response);
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data || error.message || error;
      setDashscopeResult(`错误: ${JSON.stringify(errorMsg)}`);
      addLog("createDashscopeChatCompletion (百炼对话)", "error", errorMsg);
    } finally {
      setDashscopeLoading(false);
      setDashscopeAbortController(null);
    }
  };

  const handleDashscopeCancel = () => {
    if (dashscopeAbortController) {
      dashscopeAbortController.abort();
      setDashscopeLoading(false);
      setDashscopeResult((prev) => prev + "\n[已取消]");
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,240,255,0.08)_0%,transparent_60%)]" />
      </div>

      <main className="flex-1 overflow-y-auto scroll-smooth p-8">
        <div className="flex justify-between items-center mb-8 border-b border-white/8 pb-4">
          <h1 className="text-2xl font-semibold tracking-wider text-white/80 uppercase">
            TEST // 积分 API 测试
          </h1>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1.5 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            清除日志
          </button>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：API 测试按钮 */}
          <div className="space-y-6">
            {/* 用户侧 API */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-cyan-400 mb-4">
                用户侧 API（jike-web-api）
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <TestButton
                    label="每日签到"
                    onClick={handleDailyResign}
                    loading={loadingMap["dailyResign (每日签到)"]}
                  />
                  <TestButton
                    label="初始化积分"
                    onClick={handleInitScore}
                    loading={loadingMap["initScore (初始化积分)"]}
                  />
                  <TestButton
                    label="获取积分配置"
                    onClick={handleGetScoreConfig}
                    loading={loadingMap["getScoreConfig (获取积分配置)"]}
                  />
                  <TestButton
                    label="获取积分余额"
                    onClick={handleGetBalanceInfo}
                    loading={loadingMap["getBalanceInfo (获取积分余额)"]}
                  />
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">
                      用户 ID（默认当前登录）
                    </label>
                    <input
                      type="text"
                      value={vipScoreData.userId}
                      onChange={(e) =>
                        setVipScoreData((prev) => ({
                          ...prev,
                          userId: e.target.value,
                        }))
                      }
                      placeholder="留空则使用当前登录用户"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-56 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">
                      VIP 积分变动
                    </label>
                    <input
                      type="number"
                      value={vipScoreData.vipScoreDelta}
                      onChange={(e) =>
                        setVipScoreData((prev) => ({
                          ...prev,
                          vipScoreDelta: Number(e.target.value),
                        }))
                      }
                      placeholder="可正可负"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-32 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <TestButton
                    label="更新会员积分"
                    onClick={handleUpdateVipScore}
                    loading={loadingMap["updateVipScore (更新会员积分)"]}
                    variant="outline"
                  />
                </div>
              </div>
            </section>

            {/* 管理侧 API */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-purple-400 mb-4">
                管理侧 API（jike-admin-api）
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">用户 UUID</label>
                    <input
                      type="text"
                      value={uuidInput}
                      onChange={(e) => setUuidInput(e.target.value)}
                      placeholder="输入 UUID"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-40 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <TestButton
                    label="查询用户积分"
                    onClick={handleGetUserScoreByUuid}
                    loading={loadingMap["getUserScoreByUuid (查询用户积分)"]}
                    variant="outline"
                  />
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">目标用户 ID</label>
                    <input
                      type="text"
                      value={adminScoreData.toUserId}
                      onChange={(e) =>
                        setAdminScoreData((prev) => ({
                          ...prev,
                          toUserId: e.target.value,
                        }))
                      }
                      placeholder="toUserId"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-40 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">积分数量</label>
                    <input
                      type="number"
                      value={adminScoreData.score}
                      onChange={(e) =>
                        setAdminScoreData((prev) => ({
                          ...prev,
                          score: Number(e.target.value),
                        }))
                      }
                      placeholder="score"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-28 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <TestButton
                    label="管理员加积分"
                    onClick={handleAdminAddScore}
                    loading={loadingMap["adminAddScore (管理员加积分)"]}
                    variant="outline"
                  />
                </div>
                <TestButton
                  label="获取管理员配置"
                  onClick={handleAdminGetScoreConfig}
                  loading={loadingMap["adminGetScoreConfig (管理员获取配置)"]}
                  variant="ghost"
                />
              </div>
            </section>

            {/* 内部接口 */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-orange-400 mb-4">
                内部接口（jike-web-api /inner）
              </h2>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">用户 ID</label>
                  <input
                    type="text"
                    value={innerScoreData.userId}
                    onChange={(e) =>
                      setInnerScoreData((prev) => ({
                        ...prev,
                        userId: e.target.value,
                      }))
                    }
                    placeholder="userId"
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-40 focus:border-cyan-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">积分数量</label>
                  <input
                    type="number"
                    value={innerScoreData.score}
                    onChange={(e) =>
                      setInnerScoreData((prev) => ({
                        ...prev,
                        score: Number(e.target.value),
                      }))
                    }
                    placeholder="score"
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-28 focus:border-cyan-500 outline-none"
                  />
                </div>
                <TestButton
                  label="内部添加积分"
                  onClick={handleInnerAddUserScore}
                  loading={loadingMap["innerAddUserScore (内部加积分)"]}
                  variant="outline"
                />
              </div>
            </section>

            {/* 充值订单 API */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                充值订单 API（jike-web-api /recharge/v1）
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">
                      用户 ID（默认当前登录）
                    </label>
                    <input
                      type="text"
                      value={rechargeData.userId}
                      onChange={(e) =>
                        setRechargeData((prev) => ({
                          ...prev,
                          userId: e.target.value,
                        }))
                      }
                      placeholder="留空则使用当前登录用户"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-56 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">套餐 ID</label>
                    <input
                      type="text"
                      value={rechargeData.packageId}
                      onChange={(e) =>
                        setRechargeData((prev) => ({
                          ...prev,
                          packageId: e.target.value,
                        }))
                      }
                      placeholder="packageId"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-36 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <TestButton
                    label="创建充值订单"
                    onClick={handleCreateRechargeOrder}
                    loading={loadingMap["createRechargeOrder (创建充值订单)"]}
                    variant="outline"
                  />
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">
                      订单号（可手动输入或自动填充）
                    </label>
                    <input
                      type="text"
                      value={lastOrderId}
                      onChange={(e) => setLastOrderId(e.target.value)}
                      placeholder="orderId"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-48 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <TestButton
                    label="查询订单状态"
                    onClick={handleGetRechargeOrderStatus}
                    loading={loadingMap["getRechargeOrderStatus (查询订单状态)"]}
                    variant="outline"
                  />
                </div>

                {orderStatus && (
                  <div className="p-3 bg-black/30 rounded border border-white/10">
                    <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">
                      订单状态详情
                    </div>
                    <pre className="text-xs text-emerald-300 whitespace-pre-wrap break-all font-mono max-h-40 overflow-y-auto">
                      {JSON.stringify(orderStatus, null, 2)}
                    </pre>
                  </div>
                )}

                {codeUrl && (
                  <div className="mt-4 p-3 bg-black/30 rounded border border-white/10">
                    <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">
                      二维码链接（已自动弹出扫码窗口）
                    </div>
                    <div className="text-xs text-emerald-300 break-all font-mono bg-black/20 p-2 rounded">
                      {codeUrl}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 阿里云百炼 API */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-yellow-400 mb-4">
                阿里云百炼 API（Dashscope）
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">模型</label>
                    <select
                      value={dashscopeModel}
                      onChange={(e) => setDashscopeModel(e.target.value)}
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-44 focus:border-yellow-500 outline-none"
                    >
                      <option value="qwen-turbo">qwen-turbo</option>
                      <option value="qwen-plus">qwen-plus</option>
                      <option value="qwen-max">qwen-max</option>
                      <option value="qwen-max-long">qwen-max-long</option>
                      <option value="qwen-coder-turbo">qwen-coder-turbo</option>
                      <option value="qwen2.5-72b-instruct">
                        qwen2.5-72b-instruct
                      </option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="dashscope-stream"
                      checked={dashscopeStream}
                      onChange={(e) => setDashscopeStream(e.target.checked)}
                      className="w-4 h-4 accent-yellow-500"
                    />
                    <label
                      htmlFor="dashscope-stream"
                      className="text-sm text-white/70"
                    >
                      流式输出
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">消息内容</label>
                  <textarea
                    value={dashscopeMessage}
                    onChange={(e) => setDashscopeMessage(e.target.value)}
                    placeholder="输入消息..."
                    rows={3}
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-full focus:border-yellow-500 outline-none resize-none"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <TestButton
                    label={dashscopeStream ? "开始对话 (流式)" : "开始对话"}
                    onClick={handleDashscopeChat}
                    loading={dashscopeLoading}
                    variant="default"
                  />
                  {dashscopeLoading && (
                    <TestButton
                      label="取消"
                      onClick={handleDashscopeCancel}
                      variant="outline"
                    />
                  )}
                </div>
                {dashscopeResult && (
                  <div className="mt-4 p-3 bg-black/30 rounded border border-white/10">
                    <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">
                      响应结果
                    </div>
                    <pre className="text-sm text-green-300 whitespace-pre-wrap break-all font-mono max-h-60 overflow-y-auto">
                      {dashscopeResult}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* 右侧：日志面板 */}
          <LogPanel logs={logs} />
        </div>
      </main>

      {/* 微信支付二维码弹窗 */}
      {showQRModal && codeUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-white/20 max-w-sm w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">微信支付扫码</h3>
              <div className="flex items-center gap-2">
                {isPolling && (
                  <span className="text-xs text-emerald-400 animate-pulse">
                    轮询中... 🔄
                  </span>
                )}
                <button
                  onClick={stopPollingAndClose}
                  className="text-white/50 hover:text-white text-xl leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg mb-4">
              {isGeneratingQR ? (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-gray-500">
                  生成二维码中...
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="微信支付二维码"
                  className="w-full max-w-[200px] mx-auto"
                />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-gray-500">
                  二维码加载失败
                </div>
              )}
            </div>

            <p className="text-sm text-white/60 text-center mb-4">
              请使用微信扫码支付，支付成功后积分将自动到账
            </p>

            {orderStatus && (
              <div className="text-xs text-white/40 text-center">
                订单状态: {JSON.stringify(orderStatus)}
              </div>
            )}

            <button
              onClick={stopPollingAndClose}
              className="w-full mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

