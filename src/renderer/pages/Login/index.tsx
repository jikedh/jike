import { IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJikeingToken, setJikeingToken, setJikeingUserId } from "shared/utils/utils";
import {
  getDigitalCaptcha,
  getSceneQrcode,
  loginByUsername,
} from "@/api/jikeGo";
import iconImg from "@/assets/icon.png";
import logoImg from "@/assets/logo.png";
import { useQrcodePolling } from "@/hooks/useQrcodePolling";
import HomePage from "@/pages/Home";
import { useUserStore } from "@/stores/useUserStore";

// ===================== 常量配置 =====================
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 10000;
const REDIRECT_DELAY = 500;

// 登录模式
type LoginMode = "qrcode" | "password";

// 扫码登录状态
type QrcodeStatus =
  | "loading"
  | "waiting"
  | "scanned"
  | "success"
  | "expired"
  | "error";

// ===================== 重复样式抽取 =====================
const cardStyle: React.CSSProperties = {
  background:
    "linear-gradient(145deg, rgba(26, 28, 51, 0.95) 0%, rgba(17, 18, 33, 0.95) 100%)",
  backdropFilter: "blur(10px)",
  boxShadow:
    "0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.03)",
};

const titleDecorationStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #a053db 0%, #4c62fb 100%)",
  boxShadow: "0 1px 4px rgba(76, 98, 251, 0.4)",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#fff",
  outline: "none",
};

const LoginPage = () => {
  const navigate = useNavigate();

  // ===================== 通用状态 =====================
  const [loginMode, setLoginMode] = useState<LoginMode>("qrcode");

  // ===================== 扫码登录状态 =====================
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [qrcodeStatus, setQrcodeStatus] = useState<QrcodeStatus>("loading");
  const [qrcodeError, setQrcodeError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // ===================== 账号密码登录状态 =====================
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // ===================== 扫码登录逻辑 =====================
  const handlePollingSuccess = useCallback(
    async () => {
      setQrcodeStatus("success");
      await useUserStore.getState().fetchUserInfo();
      setTimeout(() => {
        navigate("/home");
      }, REDIRECT_DELAY);
    },
    [navigate],
  );

  const { startPolling, stopPolling } = useQrcodePolling({
    onSuccess: handlePollingSuccess,
  });

  const fetchQrcode = useCallback(async () => {
    setQrcodeStatus("loading");
    setQrcodeError("");
    setRetryCount(0);

    const attemptFetch = async (currentRetry = 0): Promise<void> => {
      try {
        const res = await getSceneQrcode();
        setQrCodeUrl(res.data.qrcode_image);
        setSceneId(res.data.scene_id);
        setQrcodeStatus("waiting");
        setRetryCount(0);
      } catch (error) {
        const err = error as Error;

        if (currentRetry < MAX_RETRY_COUNT) {
          setRetryCount(currentRetry + 1);
          setQrcodeError(
            `获取二维码失败，正在重试 (${currentRetry + 1}/${MAX_RETRY_COUNT})...`,
          );
          setTimeout(() => attemptFetch(currentRetry + 1), RETRY_DELAY);
        } else {
          setQrcodeStatus("error");
          setQrcodeError(err.message || "获取二维码失败，请重试");
        }
      }
    };

    await attemptFetch(0);
  }, []);

  const handleRefresh = useCallback(() => {
    stopPolling();
    fetchQrcode();
  }, [stopPolling, fetchQrcode]);

  // ===================== 验证码获取 =====================
  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await getDigitalCaptcha();
      const data = res.data;
      setCaptchaId(data?.captcha_id || "");
      const rawPic = data?.pic_path || "";
      setCaptchaImage(
        rawPic.startsWith("data:image") ? rawPic : `data:image/png;base64,${rawPic}`,
      );
    } catch {
      setPwdError("获取验证码失败");
    }
  }, []);

  // ===================== 账号密码登录 =====================
  const handlePasswordLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setPwdError("请输入用户名和密码");
      return;
    }
    if (!captchaAnswer.trim()) {
      setPwdError("请输入验证码");
      return;
    }

    setPwdLoading(true);
    setPwdError("");

    try {
      const res = await loginByUsername({
        username: username.trim(),
        password,
        captcha_id: captchaId,
        captcha_answer: captchaAnswer.trim(),
      });

      if (res.data?.token) {
        setJikeingToken(res.data.token);
        if (res.data.id) {
          setJikeingUserId(String(res.data.id));
        }
        await useUserStore.getState().fetchUserInfo();
        setTimeout(() => {
          navigate("/home");
        }, REDIRECT_DELAY);
      } else {
        setPwdError(res.msg || "登录失败");
        fetchCaptcha();
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.msg ||
        error?.message ||
        "登录失败，请重试";
      setPwdError(msg);
      fetchCaptcha();
    } finally {
      setPwdLoading(false);
    }
  }, [username, password, captchaId, captchaAnswer, navigate, fetchCaptcha]);

  // 切换登录模式
  const handleSwitchMode = useCallback(
    (mode: LoginMode) => {
      setLoginMode(mode);
      setPwdError("");
      if (mode === "qrcode") {
        stopPolling();
        fetchQrcode();
      } else {
        stopPolling();
        fetchCaptcha();
      }
    },
    [stopPolling, fetchQrcode, fetchCaptcha],
  );

  // ===================== 初始化 =====================
  useEffect(() => {
    const token = getJikeingToken();
    if (token) {
      useUserStore.getState().fetchUserInfo();
      navigate("/home");
      return;
    }
    fetchQrcode();
  }, [fetchQrcode, navigate]);

  // 启动扫码轮询
  useEffect(() => {
    if (sceneId && qrcodeStatus === "waiting") {
      startPolling(sceneId);
    }
    return () => stopPolling();
  }, [sceneId, qrcodeStatus, startPolling, stopPolling]);

  // ===================== 渲染 =====================
  const isQrcodeError = qrcodeStatus === "expired" || qrcodeStatus === "error";
  const isQrcode = loginMode === "qrcode";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 z-0">
        <div className="blur-sm pointer-events-none">
          <HomePage />
        </div>
      </div>

      {/* 登录卡片容器 */}
      <div className="absolute inset-0 z-10 flex justify-center items-center">
        <div
          className="w-[440px] relative overflow-hidden rounded-lg"
          style={{
            minHeight: isQrcode ? "620px" : "680px",
            background: `radial-gradient(circle at 50% 0%, rgba(45, 52, 102, 0.5) 0%, transparent 60%),
                        linear-gradient(180deg, #0f1123 0%, #04050b 100%)`,
            boxShadow:
              "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          }}
        >
          <div className="flex flex-col items-center pt-[60px] relative z-10">
            {/* Logo */}
            <header className="mb-[40px]">
              <img
                src={logoImg}
                alt="即刻"
                className="h-[60px] object-contain"
                style={{
                  filter: "drop-shadow(0 4px 12px rgba(0, 85, 255, 0.4))",
                }}
              />
            </header>

            {/* 登录卡片 */}
            <div
              className="w-[330px] rounded-2xl flex flex-col items-center py-[35px] pb-[45px] relative z-10"
              style={cardStyle}
            >
              {/* 模式切换标签 */}
              <div className="flex gap-1 mb-[30px] p-1 rounded-lg"
                style={{ background: "rgba(255, 255, 255, 0.06)" }}>
                <button
                  onClick={() => handleSwitchMode("qrcode")}
                  className="px-5 py-1.5 rounded-md text-sm transition-colors"
                  style={{
                    background: isQrcode
                      ? "linear-gradient(90deg, #a053db 0%, #4c62fb 100%)"
                      : "transparent",
                    color: isQrcode ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  微信登录
                </button>
                <button
                  onClick={() => handleSwitchMode("password")}
                  className="px-5 py-1.5 rounded-md text-sm transition-colors"
                  style={{
                    background: !isQrcode
                      ? "linear-gradient(90deg, #a053db 0%, #4c62fb 100%)"
                      : "transparent",
                    color: !isQrcode ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  账号登录
                </button>
              </div>

              {/* 标题 */}
              <div className="text-white text-base font-medium mb-[35px] relative pb-2 tracking-wider">
                {isQrcode ? "微信登录" : "账号登录"}
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] rounded"
                  style={titleDecorationStyle}
                />
              </div>

              {/* ==================== 扫码登录区域 ==================== */}
              {isQrcode && (
                <>
                  {isQrcodeError ? (
                    <>
                      <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-6 py-3 bg-white rounded-lg text-gray-800 hover:bg-gray-100"
                      >
                        <IconRefresh size={18} />
                        刷新二维码
                      </button>
                      <div className="mt-4 text-sm text-red-400 tracking-wide">
                        {qrcodeStatus === "expired" ? "二维码已过期" : qrcodeError}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 二维码区域 */}
                      <div
                        className="bg-white p-2 rounded-md relative mb-[40px]"
                        style={{ boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)" }}
                      >
                        {qrcodeStatus === "loading" ? (
                          <div className="w-[170px] h-[170px] flex flex-col items-center justify-center bg-gray-100 rounded gap-3">
                            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                            {retryCount > 0 && (
                              <span className="text-xs text-gray-500">
                                重试中 ({retryCount}/{MAX_RETRY_COUNT})
                              </span>
                            )}
                          </div>
                        ) : (
                          <img
                            src={qrCodeUrl}
                            alt="微信登录二维码"
                            className="w-[170px] h-[170px] block"
                            onError={(e) => {
                              console.error("[登录] 二维码图片加载失败");
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        {/* Logo 遮罩 */}
                        <div
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-lg flex justify-center items-center"
                          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                        >
                          <img
                            src={iconImg}
                            alt="即刻"
                            className="w-6 h-6 object-contain"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ==================== 账号密码登录区域 ==================== */}
              {!isQrcode && (
                <div className="w-full px-[30px] flex flex-col gap-4">
                  {/* 用户名 */}
                  <input
                    type="text"
                    placeholder="用户名 / UUID"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                    className="w-full h-[42px] px-3 rounded-lg text-sm placeholder-gray-500"
                    style={inputStyle}
                  />

                  {/* 密码 */}
                  <input
                    type="password"
                    placeholder="密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                    className="w-full h-[42px] px-3 rounded-lg text-sm placeholder-gray-500"
                    style={inputStyle}
                  />

                  {/* 验证码 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="验证码"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                      className="flex-1 h-[42px] px-3 rounded-lg text-sm placeholder-gray-500"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      className="w-[100px] h-[42px] rounded-lg overflow-hidden shrink-0 bg-white"
                    >
                      {captchaImage ? (
                        <img
                          src={captchaImage}
                          alt="验证码"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          加载中
                        </div>
                      )}
                    </button>
                  </div>

                  {/* 错误提示 */}
                  {pwdError && (
                    <div className="text-sm text-red-400 text-center">
                      {pwdError}
                    </div>
                  )}

                  {/* 登录按钮 */}
                  <button
                    onClick={handlePasswordLogin}
                    disabled={pwdLoading}
                    className="w-full h-[42px] rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50"
                    style={{
                      background:
                        "linear-gradient(90deg, #a053db 0%, #4c62fb 100%)",
                    }}
                  >
                    {pwdLoading ? "登录中..." : "登 录"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
