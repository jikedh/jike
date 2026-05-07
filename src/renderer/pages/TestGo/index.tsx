import { useState } from "react";
import {
  setJikeingToken,
  setJikeingUserId,
  setJikeingUserInfo,
} from "shared/utils/utils";
import {
  createDesktopChatCompletions,
  createDesktopProxyTask,
  type DesktopProxyPlatform,
  getOssPutUrl,
  type OssBlobType,
  getDigitalCaptcha,
  getJikeGoUserInfo,
  getSceneQrcode,
  healthCheck,
  loginByUsername,
  queryDesktopProxyTask,
  querySceneStatus,
  registerByUsername,
  updateJikeGoUserInfo,
} from "@/api/jikeGo";

const DESKTOP_PROXY_POLL_INTERVAL = 5000;
const DESKTOP_PROXY_MAX_POLL_COUNT = 60;

const wait = (timeout: number) =>
  new Promise((resolve) => setTimeout(resolve, timeout));

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
              className={`text-xs p-2 rounded ${log.status === "success"
                  ? "bg-green-900/30 text-green-300"
                  : "bg-red-900/30 text-red-300"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="opacity-60">{log.time}</span>
                <span className="font-semibold">{log.api}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${log.status === "success" ? "bg-green-800/50" : "bg-red-800/50"
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

const getTaskId = (response: any) =>
  response?.data?.task_id ||
  response?.output?.task_id ||
  response?.result?.task_id ||
  response?.data?.taskId ||
  response?.output?.taskId ||
  response?.id ||
  response?.task_id ||
  response?.taskId ||
  "";

const getTaskStatus = (response: any) =>
  String(
    response?.data?.status ||
    response?.data?.task_status ||
    response?.output?.task_status ||
    response?.output?.status ||
    response?.result?.status ||
    response?.status ||
    "",
  ).toLowerCase();

const isTaskCompleted = (status: string) =>
  ["completed", "succeeded", "success", "done", "finished"].includes(status);

const isTaskFailed = (status: string) =>
  ["failed", "fail", "error", "canceled", "cancelled"].includes(status);

const getMediaUrls = (response: any): string[] => {
  const resultData =
    response?.result?.data || response?.data?.result?.data || response?.data?.data;
  const urls = Array.isArray(resultData)
    ? resultData
      .map((item: any) =>
        typeof item === "string"
          ? item
          : item?.url || item?.image_url || item?.video_url || "",
      )
      .filter(Boolean)
    : [];

  return [
    ...urls,
    response?.output?.video_url,
    response?.data?.video_url,
    response?.output?.image_url,
    response?.data?.image_url,
  ].filter(Boolean);
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
  const [ossApiData, setOssApiData] = useState({
    blobType: "image" as OssBlobType,
    ext: "png",
    putUrl: "",
    accessUrl: "",
  });
  const [captchaImage, setCaptchaImage] = useState("");
  const [sceneQrcodeImage, setSceneQrcodeImage] = useState("");
  const [chatApiData, setChatApiData] = useState({
    platform: "dashscope" as "dashscope" | "toapi",
    model: "qwen-plus",
    message: "你好，请用一句话介绍即刻桌面代理。",
  });
  const [imageApiData, setImageApiData] = useState({
    model: "gpt-image-2",
    prompt: "一张极简科技风桌面应用宣传海报，深色背景，蓝色霓虹光效",
    size: "1024x1024",
    taskId: "",
    resultUrls: [] as string[],
  });
  const [videoApiData, setVideoApiData] = useState({
    platform: "dashscope" as "kuaizi" | "dashscope",
    model: "wan2.7-t2v",
    prompt: "一段科技感产品展示视频，镜头缓慢推进，深色背景，蓝色光线",
    duration: 5,
    ratio: "16:9",
    taskId: "",
    resultUrls: [] as string[],
  });

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

  const handleGetOssPutUrl = () => {
    callApi("getOssPutUrl (/v1/oss/put-url)", () =>
      getOssPutUrl({
        blob_type: ossApiData.blobType,
        ext: ossApiData.ext,
      }),
    ).then((res: any) => {
      const data = getResponseData(res);
      setOssApiData((prev) => ({
        ...prev,
        putUrl: data?.put_url || data?.putUrl || "",
        accessUrl: data?.access_url || data?.accessUrl || "",
      }));
    });
  };

  const handleChatPlatformChange = (platform: "dashscope" | "toapi") => {
    setChatApiData((prev) => ({
      ...prev,
      platform,
      model: platform === "dashscope" ? "qwen-plus" : "gpt-4o-mini",
    }));
  };

  const handleVideoPlatformChange = (platform: "kuaizi" | "dashscope") => {
    setVideoApiData((prev) => ({
      ...prev,
      platform,
      model: platform === "dashscope" ? "wan2.7-t2v" : "seedance-2.0-fast",
    }));
  };

  const pollDesktopTask = async ({
    apiName,
    taskId,
    platform,
    buildQueryPath,
    buildQueryBody,
    onResultUrls,
  }: {
    apiName: string;
    taskId: string;
    platform: DesktopProxyPlatform;
    buildQueryPath: (taskId: string) => string;
    buildQueryBody?: (taskId: string) => any;
    onResultUrls: (urls: string[]) => void;
  }) => {
    for (let count = 1; count <= DESKTOP_PROXY_MAX_POLL_COUNT; count += 1) {
      await wait(DESKTOP_PROXY_POLL_INTERVAL);
      const response = await queryDesktopProxyTask({
        platform,
        method: buildQueryBody ? "POST" : "GET",
        upstreamPath: buildQueryPath(taskId),
        body: buildQueryBody?.(taskId),
      });
      const data = getResponseData(response);
      const status = getTaskStatus(data);
      const resultUrls = getMediaUrls(data);

      addLog(`${apiName} 第 ${count} 次轮询`, "success", response);
      if (resultUrls.length) {
        onResultUrls(resultUrls);
      }
      if (isTaskCompleted(status) || isTaskFailed(status)) {
        return response;
      }
    }

    throw new Error("任务轮询超时");
  };

  const handleDesktopChat = () => {
    const message = chatApiData.message.trim();
    if (!message) {
      alert("请输入对话内容");
      return;
    }

    return callApi("desktopChatCompletions (桌面代理对话)", () =>
      createDesktopChatCompletions({
        platform: chatApiData.platform,
        upstreamPath:
          chatApiData.platform === "dashscope"
            ? "/compatible-mode/v1/chat/completions"
            : "/v1/chat/completions",
        model: chatApiData.model,
        stream: false,
        messages: [{ role: "user", content: message }],
      }),
    );
  };

  const handleCreateImageTask = async () => {
    const apiName = "desktopImageGeneration (图片生成)";
    const prompt = imageApiData.prompt.trim();
    if (!prompt) {
      alert("请输入图片提示词");
      return;
    }

    setLoadingMap((prev) => ({ ...prev, [apiName]: true }));
    setImageApiData((prev) => ({ ...prev, taskId: "", resultUrls: [] }));

    try {
      const response = await createDesktopProxyTask({
        platform: "toapi",
        method: "POST",
        upstreamPath: "/v1/images/generations",
        body: {
          model: imageApiData.model,
          prompt,
          size: imageApiData.size,
          n: 1,
        },
      });
      const taskId = getTaskId(getResponseData(response));
      addLog(`${apiName} 创建任务`, "success", response);

      if (!taskId) {
        throw new Error("未返回图片任务 ID");
      }

      setImageApiData((prev) => ({ ...prev, taskId }));
      await pollDesktopTask({
        apiName,
        taskId,
        platform: "toapi",
        buildQueryPath: (id) => `/v1/images/generations/${id}`,
        onResultUrls: (urls) =>
          setImageApiData((prev) => ({ ...prev, resultUrls: urls })),
      });
    } catch (error: any) {
      console.error(`[${apiName}] 错误:`, error);
      addLog(apiName, "error", error?.response?.data || error.message || error);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [apiName]: false }));
    }
  };

  const handleCreateVideoTask = async () => {
    const apiName = "desktopVideoGeneration (视频生成)";
    const prompt = videoApiData.prompt.trim();
    if (!prompt) {
      alert("请输入视频提示词");
      return;
    }

    setLoadingMap((prev) => ({ ...prev, [apiName]: true }));
    setVideoApiData((prev) => ({ ...prev, taskId: "", resultUrls: [] }));

    try {
      const isDashscope = videoApiData.platform === "dashscope";
      const response = await createDesktopProxyTask({
        platform: videoApiData.platform,
        method: "POST",
        upstreamPath: isDashscope
          ? "/api/v1/services/aigc/video-generation/video-synthesis"
          : "/v1/lz/video/task/create",
        headers: isDashscope ? { "X-DashScope-Async": "enable" } : {},
        body: isDashscope
          ? {
            model: videoApiData.model,
            input: { prompt },
            parameters: {
              resolution: "720P",
              ratio: videoApiData.ratio,
              duration: Number(videoApiData.duration),
              prompt_extend: true,
              watermark: false,
            },
          }
          : {
            model: videoApiData.model,
            prompt,
            generation_type: "video",
            mode: videoApiData.model.includes("fast") ? "fast" : "pro",
            resolution: "720p",
            ratio: videoApiData.ratio,
            duration: Number(videoApiData.duration),
            generate_audio: false,
          },
      });
      const taskId = getTaskId(getResponseData(response));
      addLog(`${apiName} 创建任务`, "success", response);

      if (!taskId) {
        throw new Error("未返回视频任务 ID");
      }

      setVideoApiData((prev) => ({ ...prev, taskId }));
      await pollDesktopTask({
        apiName,
        taskId,
        platform: videoApiData.platform,
        buildQueryPath: (id) =>
          isDashscope ? `/api/v1/tasks/${id}` : "/v1/lz/video/task/status",
        buildQueryBody: isDashscope ? undefined : (id) => ({ task_id: id }),
        onResultUrls: (urls) =>
          setVideoApiData((prev) => ({ ...prev, resultUrls: urls })),
      });
    } catch (error: any) {
      console.error(`[${apiName}] 错误:`, error);
      addLog(apiName, "error", error?.response?.data || error.message || error);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [apiName]: false }));
    }
  };

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

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-6">
          <div className="space-y-6">
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

            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-cyan-400 mb-4">
                OSS 上传 URL 测试（/v1/oss/put-url）
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">blob_type</label>
                    <select
                      value={ossApiData.blobType}
                      onChange={(event) =>
                        setOssApiData((prev) => ({
                          ...prev,
                          blobType: event.target.value as OssBlobType,
                        }))
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                    >
                      <option value="avatar">avatar</option>
                      <option value="image">image</option>
                      <option value="video">video</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">ext</label>
                    <input
                      type="text"
                      value={ossApiData.ext}
                      onChange={(event) =>
                        setOssApiData((prev) => ({
                          ...prev,
                          ext: event.target.value,
                        }))
                      }
                      placeholder="png / jpg / mp4"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>
                <TestButton
                  label="获取 OSS 上传 URL"
                  onClick={handleGetOssPutUrl}
                  loading={loadingMap["getOssPutUrl (/v1/oss/put-url)"]}
                  variant="outline"
                />
                {(ossApiData.putUrl || ossApiData.accessUrl) && (
                  <div className="space-y-3 p-3 bg-black/30 rounded border border-white/10 text-xs">
                    {ossApiData.putUrl && (
                      <div>
                        <div className="text-white/50 mb-1 uppercase tracking-wider">
                          put_url
                        </div>
                        <div className="text-cyan-200 break-all font-mono">
                          {ossApiData.putUrl}
                        </div>
                      </div>
                    )}
                    {ossApiData.accessUrl && (
                      <div>
                        <div className="text-white/50 mb-1 uppercase tracking-wider">
                          access_url
                        </div>
                        <a
                          href={ossApiData.accessUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-200 hover:text-cyan-100 break-all font-mono"
                        >
                          {ossApiData.accessUrl}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                对话测试（Desktop Proxy /chat/completions）
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">平台</label>
                    <select
                      value={chatApiData.platform}
                      onChange={(event) =>
                        handleChatPlatformChange(
                          event.target.value as "dashscope" | "toapi",
                        )
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                    >
                      <option value="dashscope">dashscope</option>
                      <option value="toapi">toapi</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">模型</label>
                    <input
                      type="text"
                      value={chatApiData.model}
                      onChange={(event) =>
                        setChatApiData((prev) => ({
                          ...prev,
                          model: event.target.value,
                        }))
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">对话内容</label>
                  <textarea
                    value={chatApiData.message}
                    onChange={(event) =>
                      setChatApiData((prev) => ({
                        ...prev,
                        message: event.target.value,
                      }))
                    }
                    rows={4}
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none resize-none"
                  />
                </div>
                <TestButton
                  label="发送对话请求"
                  onClick={handleDesktopChat}
                  loading={loadingMap["desktopChatCompletions (桌面代理对话)"]}
                  variant="outline"
                />
              </div>
            </section>

            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-fuchsia-400 mb-4">
                图片生成测试（toapi，5 秒轮询）
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">平台</label>
                    <select
                      value="toapi"
                      disabled
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm text-white/50 outline-none"
                    >
                      <option value="toapi">toapi</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">模型</label>
                    <input
                      type="text"
                      value={imageApiData.model}
                      onChange={(event) =>
                        setImageApiData((prev) => ({
                          ...prev,
                          model: event.target.value,
                        }))
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-fuchsia-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">尺寸</label>
                    <input
                      type="text"
                      value={imageApiData.size}
                      onChange={(event) =>
                        setImageApiData((prev) => ({
                          ...prev,
                          size: event.target.value,
                        }))
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-fuchsia-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">图片提示词</label>
                  <textarea
                    value={imageApiData.prompt}
                    onChange={(event) =>
                      setImageApiData((prev) => ({
                        ...prev,
                        prompt: event.target.value,
                      }))
                    }
                    rows={4}
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-fuchsia-500 outline-none resize-none"
                  />
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <TestButton
                    label="创建图片任务并轮询"
                    onClick={handleCreateImageTask}
                    loading={loadingMap["desktopImageGeneration (图片生成)"]}
                    variant="outline"
                  />
                  {imageApiData.taskId && (
                    <span className="text-xs text-white/50">
                      task_id: {imageApiData.taskId}
                    </span>
                  )}
                </div>
                {imageApiData.resultUrls.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {imageApiData.resultUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt="图片生成结果"
                        className="w-full rounded bg-black/30 border border-white/10"
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-orange-400 mb-4">
                视频生成测试（kuaizi / dashscope，5 秒轮询）
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">平台</label>
                    <select
                      value={videoApiData.platform}
                      onChange={(event) =>
                        handleVideoPlatformChange(
                          event.target.value as "kuaizi" | "dashscope",
                        )
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none"
                    >
                      <option value="dashscope">dashscope</option>
                      <option value="kuaizi">kuaizi</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">模型</label>
                    <input
                      type="text"
                      value={videoApiData.model}
                      onChange={(event) =>
                        setVideoApiData((prev) => ({
                          ...prev,
                          model: event.target.value,
                        }))
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">时长</label>
                    <input
                      type="number"
                      value={videoApiData.duration}
                      onChange={(event) =>
                        setVideoApiData((prev) => ({
                          ...prev,
                          duration: Number(event.target.value),
                        }))
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">比例</label>
                    <select
                      value={videoApiData.ratio}
                      onChange={(event) =>
                        setVideoApiData((prev) => ({
                          ...prev,
                          ratio: event.target.value,
                        }))
                      }
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none"
                    >
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="1:1">1:1</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">视频提示词</label>
                  <textarea
                    value={videoApiData.prompt}
                    onChange={(event) =>
                      setVideoApiData((prev) => ({
                        ...prev,
                        prompt: event.target.value,
                      }))
                    }
                    rows={4}
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none resize-none"
                  />
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <TestButton
                    label="创建视频任务并轮询"
                    onClick={handleCreateVideoTask}
                    loading={loadingMap["desktopVideoGeneration (视频生成)"]}
                    variant="outline"
                  />
                  {videoApiData.taskId && (
                    <span className="text-xs text-white/50">
                      task_id: {videoApiData.taskId}
                    </span>
                  )}
                </div>
                {videoApiData.resultUrls.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {videoApiData.resultUrls.map((url) => (
                      <video
                        key={url}
                        src={url}
                        controls
                        className="w-full rounded bg-black/30 border border-white/10"
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <LogPanel logs={logs} />
        </div>
      </main>
    </div>
  );
}
