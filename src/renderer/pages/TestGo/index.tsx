import { useState } from "react";
import {
  setJikeingToken,
  setJikeingUserId,
  setJikeingUserInfo,
} from "shared/utils/utils";
import {
  getDigitalCaptcha,
  getJikeGoUserInfo,
  getSceneQrcode,
  healthCheck,
  loginByUsername,
  querySceneStatus,
  registerByUsername,
  updateJikeGoUserInfo,
} from "@/api/jikeGo";

interface TestButtonProps {
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: "default" | "outline";
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
              className={`text-xs p-2 rounded ${
                log.status === "success"
                  ? "bg-green-900/30 text-green-300"
                  : "bg-red-900/30 text-red-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="opacity-60">{log.time}</span>
                <span className="font-semibold">{log.api}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    log.status === "success" ? "bg-green-800/50" : "bg-red-800/50"
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

export default function TestGoPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [userApiData, setUserApiData] = useState({
    username: "testuser001",
    password: "Test@1234",
    captchaId: "",
    captchaAnswer: "",
    sceneId: "",
    nickname: "新昵称",
    avatar: "https://example.com/avatar.jpg",
  });
  const [captchaImage, setCaptchaImage] = useState("");
  const [sceneQrcodeImage, setSceneQrcodeImage] = useState("");

  const addLog = (api: string, status: "success" | "error", data: any) => {
    const now = new Date();
    const time = now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [{ time, api, status, data }, ...prev]);
  };

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

  const getResponseData = (response: any) => response?.data || response;

  const saveLoginResponse = (response: any) => {
    const data = getResponseData(response);
    const token = data?.token;
    const userId = data?.id || data?.uuid;

    if (token) {
      setJikeingToken(token);
    }
    if (userId) {
      setJikeingUserId(userId);
    }
  };

  const handleHealthCheck = () => callApi("healthCheck (健康检查)", healthCheck);

  const handleGetDigitalCaptcha = () => {
    callApi("getDigitalCaptcha (获取数字验证码)", getDigitalCaptcha).then(
      (res: any) => {
        const data = getResponseData(res);
        setCaptchaImage(data?.pic_path || data?.picPath || "");
        setUserApiData((prev) => ({
          ...prev,
          captchaId: data?.captcha_id || data?.captchaId || prev.captchaId,
          captchaAnswer:
            data?.answer || data?.captcha_answer || prev.captchaAnswer,
        }));
      },
    );
  };

  const handleRegisterByUsername = () => {
    if (!userApiData.username || !userApiData.password) {
      alert("请输入用户名和密码");
      return;
    }
    if (!userApiData.captchaId || !userApiData.captchaAnswer) {
      alert("请先获取并填写验证码");
      return;
    }

    return callApi("registerByUsername (用户注册)", () =>
      registerByUsername({
        username: userApiData.username,
        password: userApiData.password,
        captcha_id: userApiData.captchaId,
        captcha_answer: userApiData.captchaAnswer,
      }),
    );
  };

  const handleLoginByUsername = () => {
    if (!userApiData.username || !userApiData.password) {
      alert("请输入用户名和密码");
      return;
    }
    if (!userApiData.captchaId || !userApiData.captchaAnswer) {
      alert("请先获取并填写验证码");
      return;
    }

    callApi("loginByUsername (用户名密码登录)", () =>
      loginByUsername({
        username: userApiData.username,
        password: userApiData.password,
        captcha_id: userApiData.captchaId,
        captcha_answer: userApiData.captchaAnswer,
      }),
    ).then(saveLoginResponse);
  };

  const handleGetSceneQrcode = () => {
    callApi("getSceneQrcode (获取登录二维码)", getSceneQrcode).then(
      (res: any) => {
        const data = getResponseData(res);
        setSceneQrcodeImage(data?.qrcode_image || "");
        setUserApiData((prev) => ({
          ...prev,
          sceneId: data?.scene_id || prev.sceneId,
        }));
      },
    );
  };

  const handleQuerySceneStatus = () => {
    if (!userApiData.sceneId) {
      alert("请先获取登录二维码或填写 scene_id");
      return;
    }

    callApi("querySceneStatus (查询扫码状态)", () =>
      querySceneStatus(userApiData.sceneId),
    ).then(saveLoginResponse);
  };

  const handleGetJikeGoUserInfo = () => {
    callApi("getJikeGoUserInfo (获取用户信息)", getJikeGoUserInfo).then(
      (res: any) => {
        const data = getResponseData(res);
        if (data?.id || data?.uuid) {
          setJikeingUserInfo(data);
        }
      },
    );
  };

  const handleUpdateJikeGoUserInfo = () =>
    callApi("updateJikeGoUserInfo (更新用户信息)", () =>
      updateJikeGoUserInfo({
        nickname: userApiData.nickname,
        avatar: userApiData.avatar,
      }),
    );

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(56,189,248,0.08)_0%,transparent_60%)]" />
      </div>

      <main className="flex-1 overflow-y-auto scroll-smooth p-8">
        <div className="flex justify-between items-center mb-8 border-b border-white/8 pb-4">
          <h1 className="text-2xl font-semibold tracking-wider text-white/80 uppercase">
            TEST GO // jike-go API 测试
          </h1>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1.5 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            清除日志
          </button>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white/5 rounded-xl p-5 border border-white/10">
            <h2 className="text-lg font-semibold text-sky-400 mb-4">
              用户基础 API（jike-go /v1/user）
            </h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <TestButton
                  label="健康检查"
                  onClick={handleHealthCheck}
                  loading={loadingMap["healthCheck (健康检查)"]}
                />
                <TestButton
                  label="获取数字验证码"
                  onClick={handleGetDigitalCaptcha}
                  loading={loadingMap["getDigitalCaptcha (获取数字验证码)"]}
                  variant="outline"
                />
                <TestButton
                  label="用户注册"
                  onClick={handleRegisterByUsername}
                  loading={loadingMap["registerByUsername (用户注册)"]}
                  variant="outline"
                />
                <TestButton
                  label="用户名密码登录"
                  onClick={handleLoginByUsername}
                  loading={loadingMap["loginByUsername (用户名密码登录)"]}
                  variant="outline"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">用户名</label>
                  <input
                    type="text"
                    value={userApiData.username}
                    onChange={(e) =>
                      setUserApiData((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">密码</label>
                  <input
                    type="text"
                    value={userApiData.password}
                    onChange={(e) =>
                      setUserApiData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">验证码 ID</label>
                  <input
                    type="text"
                    value={userApiData.captchaId}
                    onChange={(e) =>
                      setUserApiData((prev) => ({
                        ...prev,
                        captchaId: e.target.value,
                      }))
                    }
                    placeholder="captcha_id"
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">验证码答案</label>
                  <input
                    type="text"
                    value={userApiData.captchaAnswer}
                    onChange={(e) =>
                      setUserApiData((prev) => ({
                        ...prev,
                        captchaAnswer: e.target.value,
                      }))
                    }
                    placeholder="captcha_answer"
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              {captchaImage && (
                <div className="p-3 bg-black/30 rounded border border-white/10">
                  <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">
                    数字验证码图片
                  </div>
                  <img
                    src={captchaImage}
                    alt="数字验证码"
                    className="w-full max-w-xs rounded bg-white"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-end">
                <TestButton
                  label="获取登录二维码"
                  onClick={handleGetSceneQrcode}
                  loading={loadingMap["getSceneQrcode (获取登录二维码)"]}
                  variant="outline"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">scene_id</label>
                  <input
                    type="text"
                    value={userApiData.sceneId}
                    onChange={(e) =>
                      setUserApiData((prev) => ({
                        ...prev,
                        sceneId: e.target.value,
                      }))
                    }
                    placeholder="获取二维码后自动填充"
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-64 focus:border-sky-500 outline-none"
                  />
                </div>
                <TestButton
                  label="查询扫码状态"
                  onClick={handleQuerySceneStatus}
                  loading={loadingMap["querySceneStatus (查询扫码状态)"]}
                  variant="outline"
                />
              </div>

              {sceneQrcodeImage && (
                <div className="p-3 bg-black/30 rounded border border-white/10">
                  <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">
                    登录二维码
                  </div>
                  <img
                    src={sceneQrcodeImage}
                    alt="登录二维码"
                    className="w-full max-w-50 rounded bg-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">昵称</label>
                  <input
                    type="text"
                    value={userApiData.nickname}
                    onChange={(e) =>
                      setUserApiData((prev) => ({
                        ...prev,
                        nickname: e.target.value,
                      }))
                    }
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">头像 URL</label>
                  <input
                    type="text"
                    value={userApiData.avatar}
                    onChange={(e) =>
                      setUserApiData((prev) => ({
                        ...prev,
                        avatar: e.target.value,
                      }))
                    }
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <TestButton
                  label="获取用户信息"
                  onClick={handleGetJikeGoUserInfo}
                  loading={loadingMap["getJikeGoUserInfo (获取用户信息)"]}
                  variant="outline"
                />
                <TestButton
                  label="更新用户信息"
                  onClick={handleUpdateJikeGoUserInfo}
                  loading={loadingMap["updateJikeGoUserInfo (更新用户信息)"]}
                  variant="outline"
                />
              </div>
            </div>
          </section>

          <LogPanel logs={logs} />
        </div>
      </main>
    </div>
  );
}
