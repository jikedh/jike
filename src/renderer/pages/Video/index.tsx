/**
 * Video 页面 - 视频消除功能 Demo
 */
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
// import { Input } from "~/components/ui/input";
// import { Button } from "~/components/ui/button";
// import { videoRemoval, getVideoRemovalStatus } from "~/api/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getVideoRemovalStatus, videoRemoval } from "@/api/ai";
import {
  createRhartImageG2ImageToImage,
  createRhartImageG2OfficialImageToImage,
  createRhartImageG2OfficialTextToImage,
  createRhartImageG2TextToImage,
  createRhartImageNProEdit,
  createRhartImageNProOfficialEdit,
  createRhartImageNProOfficialTextToImage,
  createRhartImageNProTextToImage,
  createRunningHubTask,
  getUploadOssPutUrl,
  pollRunningHubTask,
  queryRunningHubV2Task,
} from "@/api/jikeGo";

export default function VideoPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold">短片合成功能正在开发中</h1>
          <p className="text-sm text-gray-500">更多短片合成能力即将上线</p>
          <div>各种Demo页面被放到了这里</div>
        </div>
      </div>
      <div className="border-t border-white/10 pt-6">
        <div className="flex flex-wrap gap-3 justify-center">
          {DEMO_LINKS.map((item) => (
            <Button key={item.path} onClick={() => navigate(item.path)} variant="blue">
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// RunningHub 工作流 Demo 组件
function RunningHubWorkflowDemo() {
  const [workflowId, setWorkflowId] = useState("1996264470320136194");
  const [instanceType, setInstanceType] = useState("plus");
  const [nodes, setNodes] = useState([
    { nodeId: "15", fieldName: "video", fieldValue: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [outputs, setOutputs] = useState<any[]>([]);
  const [error, setError] = useState("");

  // 添加节点
  const addNode = () => {
    setNodes([...nodes, { nodeId: "", fieldName: "", fieldValue: "" }]);
  };

  // 删除节点
  const removeNode = (index: number) => {
    setNodes(nodes.filter((_, i) => i !== index));
  };

  // 更新节点
  const updateNode = (
    index: number,
    field: "nodeId" | "fieldName" | "fieldValue",
    value: string,
  ) => {
    const updated = [...nodes];
    updated[index][field] = value;
    setNodes(updated);
  };

  // 提交任务
  const handleSubmit = async () => {
    if (!workflowId.trim()) {
      setError("请输入 Workflow ID");
      return;
    }
    if (!nodes[0].fieldValue.trim()) {
      setError("请输入视频 URL");
      return;
    }

    setLoading(true);
    setError("");
    setTaskId("");
    setTaskStatus("");
    setOutputs([]);

    try {
      const response: any = await createRunningHubTask({
        workflowId: workflowId.trim(),
        instanceType: instanceType.trim() || "plus",
        nodeInfoList: nodes.filter((n) => n.nodeId.trim() && n.fieldValue.trim()),
      });

      const tid = response?.data?.taskId || response?.taskId;
      if (!tid) {
        setError("未获取到 taskId: " + JSON.stringify(response));
        setLoading(false);
        return;
      }

      setTaskId(tid);
      console.log("RunningHub 任务已提交，taskId:", tid);

      // 开始轮询
      await pollTask(tid);
    } catch (err: any) {
      setError("提交失败: " + (err?.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  // 轮询任务状态
  const pollTask = async (id: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const statusResponse: any = await pollRunningHubTask({ taskId: id });
        console.log(
          `[${new Date().toLocaleTimeString()}] 任务状态:`,
          statusResponse,
        );

        const status =
          statusResponse?.data?.taskStatus || statusResponse?.taskStatus || "";
        setTaskStatus(status);

        const outputList =
          statusResponse?.data?.outputs || statusResponse?.outputs || [];

        if (status === "SUCCESS" || status === "FAILED") {
          setOutputs(outputList);
          console.log("任务完成，最终状态:", status, "输出:", outputList);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setError("达到最大轮询次数");
        }
      } catch (err: any) {
        console.error(`轮询出错 (${attempts}):`, err);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      }
    };

    await poll();
  };

  // 找出第一个视频类型的输出
  const getVideoOutput = () => {
    return outputs.find(
      (o) =>
        o.fileType?.toLowerCase().includes("mp4") ||
        o.fileType?.toLowerCase().includes("mov") ||
        o.fileType?.toLowerCase().includes("webm") ||
        /\.(mp4|mov|webm)(\?|$)/i.test(o.fileUrl || ""),
    ) || outputs[0];
  };

  const videoOutput = getVideoOutput();

  return (
    <div className="max-w-xl space-y-4 mt-8 pt-8 border-t border-white/10">
      <h2 className="text-xl font-bold mb-4">RunningHub 工作流 Demo</h2>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Workflow ID</label>
        <Input
          placeholder="例如: 1996264470320136194"
          value={workflowId}
          onChange={(e) => setWorkflowId(e.target.value)}
          className="bg-white/5 border-white/10 text-white"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Instance Type</label>
        <Input
          placeholder="默认 plus"
          value={instanceType}
          onChange={(e) => setInstanceType(e.target.value)}
          className="bg-white/5 border-white/10 text-white"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-gray-400">节点配置</label>
          <button
            onClick={addNode}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            + 添加节点
          </button>
        </div>
        {nodes.map((node, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <Input
              placeholder="Node ID"
              value={node.nodeId}
              onChange={(e) => updateNode(index, "nodeId", e.target.value)}
              className="bg-white/5 border-white/10 text-white w-24"
            />
            <Input
              placeholder="字段名 (video/image)"
              value={node.fieldName}
              onChange={(e) => updateNode(index, "fieldName", e.target.value)}
              className="bg-white/5 border-white/10 text-white w-32"
            />
            <Input
              placeholder="值 (URL 或文本)"
              value={node.fieldValue}
              onChange={(e) => updateNode(index, "fieldValue", e.target.value)}
              className="bg-white/5 border-white/10 text-white flex-1"
            />
            {nodes.length > 1 && (
              <button
                onClick={() => removeNode(index)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                删除
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded">{error}</p>
      )}

      <Button onClick={handleSubmit} disabled={loading} variant="blue">
        {loading ? "处理中..." : "提交 RunningHub 任务"}
      </Button>

      {taskId && (
        <p className="text-sm text-gray-400">当前任务ID: {taskId}</p>
      )}

      {taskStatus && (
        <p className="text-sm text-gray-400">
          任务状态:{" "}
          <span
            className={
              taskStatus === "SUCCESS"
                ? "text-green-400"
                : taskStatus === "FAILED"
                  ? "text-red-400"
                  : "text-yellow-400"
            }
          >
            {taskStatus}
          </span>
        </p>
      )}

      {videoOutput && (
        <div className="mt-4 p-4 bg-white/5 rounded-lg">
          <p className="text-sm text-gray-400 mb-2">生成结果:</p>
          <a
            href={videoOutput.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm break-all block mb-2"
          >
            {videoOutput.fileUrl}
          </a>
          <div className="text-xs text-gray-500 mb-2">
            类型: {videoOutput.fileType} | 节点: {videoOutput.nodeId} | 耗时:{" "}
            {videoOutput.taskCostTime}
          </div>
          {/\.(mp4|mov|webm)(\?|$)/i.test(videoOutput.fileUrl || "") && (
            <video
              src={videoOutput.fileUrl}
              controls
              className="mt-3 w-full max-w-lg rounded-lg"
            />
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 mt-4">
        <p>操作说明：</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>输入 Workflow ID（默认使用视频超分工作流）</li>
          <li>配置节点信息：Node ID、字段名、值（支持视频/图片 URL）</li>
          <li>点击提交后会自动创建 RunningHub 任务</li>
          <li>每5秒轮询一次任务状态，完成后显示输出文件</li>
          <li>RunningHub API Key 已硬编码在后端，前端无需传入</li>
        </ol>
      </div>
    </div>
  );
}

// RunningHub 文生图 V2 Demo 组件
function RunningHubTextToImageDemo() {
  const [forms, setForms] = useState(() =>
    RHART_IMAGE_TASKS.reduce((data, task) => ({
      ...data,
      [task.key]: {
        prompt: task.defaultPrompt,
        aspectRatio: task.defaultAspectRatio,
        resolution: task.defaultResolution,
        quality: task.defaultQuality || "medium",
      },
    }), {} as Record<string, { prompt: string; aspectRatio: string; resolution: string; quality: string }>),
  );
  const [states, setStates] = useState({} as Record<string, { loading?: boolean; taskId?: string; status?: string; error?: string; results?: any[] }>);
  const updateForm = (key: string, field: "prompt" | "aspectRatio" | "resolution" | "quality", value: string) => {
    setForms((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  };
  const updateState = (key: string, value: Record<string, any>) => {
    setStates((current) => ({
      ...current,
      [key]: { ...current[key], ...value },
    }));
  };
  const handleSubmit = async (task: (typeof RHART_IMAGE_TASKS)[number]) => {
    const form = forms[task.key];
    if (!form.prompt.trim()) {
      updateState(task.key, { error: "请输入 prompt" });
      return;
    }
    updateState(task.key, { loading: true, taskId: "", status: "", error: "", results: [] });
    try {
      const response: any = await task.submit({
        prompt: form.prompt.trim(),
        aspectRatio: form.aspectRatio,
        resolution: form.resolution,
        ...(task.hasQuality ? { quality: form.quality } : {}),
      });
      const data = response?.data ?? response;
      if (!data?.taskId) {
        updateState(task.key, { loading: false, error: "未获取到 taskId: " + JSON.stringify(response) });
        return;
      }
      updateState(task.key, { taskId: data.taskId, status: data.status || "QUEUED", results: data.results || [] });
      await pollV2Task(task.key, data.taskId);
    } catch (err: any) {
      updateState(task.key, { loading: false, error: "提交失败: " + (err?.message || JSON.stringify(err)) });
    }
  };
  const pollV2Task = async (key: string, id: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const response: any = await queryRunningHubV2Task({ taskId: id });
        const data = response?.data ?? response;
        const status = data?.status || "";
        updateState(key, { status, results: data?.results || [] });
        if (status === "SUCCESS" || status === "FAILED") {
          updateState(key, {
            loading: false,
            error: status === "FAILED" ? data?.errorMessage || "任务生成失败" : "",
          });
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          updateState(key, { loading: false, error: "达到最大轮询次数" });
        }
      } catch (err: any) {
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
          return;
        }
        updateState(key, { loading: false, error: "查询失败: " + (err?.message || JSON.stringify(err)) });
      }
    };
    await poll();
  };
  return (
    <div className="max-w-5xl space-y-4 mt-8 pt-8 border-t border-white/10">
      <h2 className="text-xl font-bold mb-4">RunningHub 文生图 V2 Demo</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {RHART_IMAGE_TASKS.map((task) => {
          const form = forms[task.key];
          const state = states[task.key] || {};
          const imageResults = (state.results || []).filter((item) => item?.url);
          return (
            <div key={task.key} className="space-y-3 p-4 bg-white/5 border-white/10 rounded-lg">
              <h3 className="font-semibold text-white">{task.title}</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prompt</label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => updateForm(task.key, "prompt", e.target.value)}
                  className="w-full min-h-28 rounded-md bg-white/5 border-white/10 text-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">比例</label>
                  <select value={form.aspectRatio} onChange={(e) => updateForm(task.key, "aspectRatio", e.target.value)} className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm">
                    {RHART_IMAGE_ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">分辨率</label>
                  <select value={form.resolution} onChange={(e) => updateForm(task.key, "resolution", e.target.value)} className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm">
                    {RHART_IMAGE_RESOLUTIONS.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}
                  </select>
                </div>
                {task.hasQuality && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">质量</label>
                    <select value={form.quality} onChange={(e) => updateForm(task.key, "quality", e.target.value)} className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm">
                      {RHART_IMAGE_QUALITIES.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <Button onClick={() => handleSubmit(task)} disabled={state.loading} variant="blue">
                {state.loading ? "生成中..." : "提交文生图任务"}
              </Button>
              {state.taskId && <p className="text-sm text-gray-400 break-all">任务ID: {state.taskId}</p>}
              {state.status && <p className="text-sm text-gray-400">状态: <span className={state.status === "SUCCESS" ? "text-green-400" : state.status === "FAILED" ? "text-red-400" : "text-yellow-400"}>{state.status}</span></p>}
              {state.error && <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded">{state.error}</p>}
              {imageResults.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  {imageResults.map((item, index) => (
                    <div key={`${item.url}-${index}`} className="bg-black/20 rounded-lg p-3">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs break-all block mb-2">{item.url}</a>
                      <img src={item.url} alt="RunningHub 生成结果" className="w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// RunningHub 图生图/编辑 V2 Demo 组件
function RunningHubImageToImageDemo() {
  const [forms, setForms] = useState(() =>
    RHART_IMAGE_TO_IMAGE_TASKS.reduce((data, task) => ({
      ...data,
      [task.key]: {
        prompt: task.defaultPrompt,
        imageUrlsText: task.defaultImageUrls.join("\n"),
        aspectRatio: task.defaultAspectRatio,
        resolution: task.defaultResolution,
        quality: task.defaultQuality || "medium",
      },
    }), {} as Record<string, { prompt: string; imageUrlsText: string; aspectRatio: string; resolution: string; quality: string }>),
  );
  const [states, setStates] = useState({} as Record<string, { loading?: boolean; taskId?: string; status?: string; error?: string; results?: any[] }>);
  const updateForm = (key: string, field: "prompt" | "imageUrlsText" | "aspectRatio" | "resolution" | "quality", value: string) => {
    setForms((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  };
  const updateState = (key: string, value: Record<string, any>) => {
    setStates((current) => ({
      ...current,
      [key]: { ...current[key], ...value },
    }));
  };
  const handleSubmit = async (task: (typeof RHART_IMAGE_TO_IMAGE_TASKS)[number]) => {
    const form = forms[task.key];
    const imageUrls = form.imageUrlsText.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    if (!form.prompt.trim()) {
      updateState(task.key, { error: "请输入 prompt" });
      return;
    }
    if (imageUrls.length === 0) {
      updateState(task.key, { error: "请输入至少 1 个图片 URL" });
      return;
    }
    updateState(task.key, { loading: true, taskId: "", status: "", error: "", results: [] });
    try {
      const response: any = await task.submit({
        prompt: form.prompt.trim(),
        imageUrls,
        aspectRatio: form.aspectRatio,
        resolution: form.resolution,
        ...(task.hasQuality ? { quality: form.quality } : {}),
      });
      const data = response?.data ?? response;
      if (!data?.taskId) {
        updateState(task.key, { loading: false, error: "未获取到 taskId: " + JSON.stringify(response) });
        return;
      }
      updateState(task.key, { taskId: data.taskId, status: data.status || "QUEUED", results: data.results || [] });
      await pollV2Task(task.key, data.taskId);
    } catch (err: any) {
      updateState(task.key, { loading: false, error: "提交失败: " + (err?.message || JSON.stringify(err)) });
    }
  };
  const pollV2Task = async (key: string, id: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const response: any = await queryRunningHubV2Task({ taskId: id });
        const data = response?.data ?? response;
        const status = data?.status || "";
        updateState(key, { status, results: data?.results || [] });
        if (status === "SUCCESS" || status === "FAILED") {
          updateState(key, {
            loading: false,
            error: status === "FAILED" ? data?.errorMessage || "任务生成失败" : "",
          });
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          updateState(key, { loading: false, error: "达到最大轮询次数" });
        }
      } catch (err: any) {
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
          return;
        }
        updateState(key, { loading: false, error: "查询失败: " + (err?.message || JSON.stringify(err)) });
      }
    };
    await poll();
  };
  return (
    <div className="max-w-5xl space-y-4 mt-8 pt-8 border-t border-white/10">
      <h2 className="text-xl font-bold mb-4">RunningHub 图生图/编辑 V2 Demo</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {RHART_IMAGE_TO_IMAGE_TASKS.map((task) => {
          const form = forms[task.key];
          const state = states[task.key] || {};
          const imageResults = (state.results || []).filter((item) => item?.url);
          return (
            <div key={task.key} className="space-y-3 p-4 bg-white/5 border-white/10 rounded-lg">
              <h3 className="font-semibold text-white">{task.title}</h3>
              <div>
                <label className="block text-sm text-gray-400 mb-1">参考图片 URL（每行一个，最多 10 个）</label>
                <textarea
                  value={form.imageUrlsText}
                  onChange={(e) => updateForm(task.key, "imageUrlsText", e.target.value)}
                  className="w-full min-h-20 rounded-md bg-white/5 border-white/10 text-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prompt</label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => updateForm(task.key, "prompt", e.target.value)}
                  className="w-full min-h-28 rounded-md bg-white/5 border-white/10 text-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">比例</label>
                  <select value={form.aspectRatio} onChange={(e) => updateForm(task.key, "aspectRatio", e.target.value)} className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm">
                    {RHART_IMAGE_ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">分辨率</label>
                  <select value={form.resolution} onChange={(e) => updateForm(task.key, "resolution", e.target.value)} className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm">
                    {RHART_IMAGE_RESOLUTIONS.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}
                  </select>
                </div>
                {task.hasQuality && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">质量</label>
                    <select value={form.quality} onChange={(e) => updateForm(task.key, "quality", e.target.value)} className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm">
                      {RHART_IMAGE_QUALITIES.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <Button onClick={() => handleSubmit(task)} disabled={state.loading} variant="blue">
                {state.loading ? "生成中..." : "提交图生图任务"}
              </Button>
              {state.taskId && <p className="text-sm text-gray-400 break-all">任务ID: {state.taskId}</p>}
              {state.status && <p className="text-sm text-gray-400">状态: <span className={state.status === "SUCCESS" ? "text-green-400" : state.status === "FAILED" ? "text-red-400" : "text-yellow-400"}>{state.status}</span></p>}
              {state.error && <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded">{state.error}</p>}
              {imageResults.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  {imageResults.map((item, index) => (
                    <div key={`${item.url}-${index}`} className="bg-black/20 rounded-lg p-3">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs break-all block mb-2">{item.url}</a>
                      <img src={item.url} alt="RunningHub 图生图结果" className="w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RHART_IMAGE_TASKS = [
  {
    key: "g2",
    title: "全能图片G-2.0-文生图-低价渠道版",
    defaultPrompt: "生成一张充满未来感的咖啡馆宣传海报。画面中央是一个发光的霓虹灯招牌，上面清晰且准确地拼写着英文单词 \"CyberBrew\"。背景是带有极简主义和现代高级感的城市街道，光影具有强烈的 Stripe UI 风格。",
    defaultAspectRatio: "16:9",
    defaultResolution: "1k",
    hasQuality: false,
    submit: createRhartImageG2TextToImage,
  },
  {
    key: "g2-official",
    title: "全能图片G-2-文生图-官方稳定版",
    defaultPrompt: "一张高端商业摄影海报。画面正中央是一个采用极简设计的白色磨砂质感智能音箱。音箱放置在浅灰色的水磨石台面上。背景是纯净的低饱和度米色墙面，一束柔和的自然光从斜上方 45 度角打下。",
    defaultAspectRatio: "16:9",
    defaultResolution: "2k",
    defaultQuality: "medium",
    hasQuality: true,
    submit: createRhartImageG2OfficialTextToImage,
  },
  {
    key: "n-pro",
    title: "全能图片PRO-文生图-低价渠道版",
    defaultPrompt: "一群猴子在茂密、阳光斑驳的热带森林中激烈争抢一根非常小的香蕉。猴子们跳跃、伸手、抓挠，表情夸张，画面充满动感，色彩鲜艳生动。",
    defaultAspectRatio: "9:16",
    defaultResolution: "1k",
    hasQuality: false,
    submit: createRhartImageNProTextToImage,
  },
  {
    key: "n-pro-official",
    title: "全能图片PRO-文生图-官方稳定版",
    defaultPrompt: "在一片广阔无垠的大海边，一只快乐的猴子坐在沙滩上，享受着温暖的阳光。天空湛蓝，阳光明媚，海浪轻拍沙滩，整体风格为手绘插画。",
    defaultAspectRatio: "3:4",
    defaultResolution: "1k",
    hasQuality: false,
    submit: createRhartImageNProOfficialTextToImage,
  },
];
const RHART_IMAGE_ASPECT_RATIOS = ["1:1", "3:2", "2:3", "5:4", "4:5", "16:9", "9:16", "21:9", "3:4", "4:3", "9:21"];
const RHART_IMAGE_RESOLUTIONS = ["1k", "2k", "4k"];
const RHART_IMAGE_QUALITIES = ["low", "medium", "high"];
const RHART_IMAGE_TO_IMAGE_TASKS = [
  {
    key: "g2",
    title: "全能图片G-2.0-图生图-低价渠道版",
    defaultPrompt: "在马克杯的正中央，添加一个精致的几何风格狐狸 Logo，Logo 下方清晰地印着文字 \"Wild Fox\"。请保持原图的光影结构和陶瓷质感完全不变。然后生成一张产品介绍说明书。",
    defaultImageUrls: [],
    defaultAspectRatio: "16:9",
    defaultResolution: "1k",
    hasQuality: false,
    submit: createRhartImageG2ImageToImage,
  },
  {
    key: "g2-official",
    title: "全能图片G-2-图生图-官方稳定版",
    defaultPrompt: "将这个客厅彻底改造为植物园温室风格。把原有的沙发替换成复古的绿色天鹅绒材质，墙面变成做旧的红砖墙。保持房间原本的物理空间大小、门窗位置以及家具摆放结构完全不变。",
    defaultImageUrls: [],
    defaultAspectRatio: "16:9",
    defaultResolution: "2k",
    defaultQuality: "medium",
    hasQuality: true,
    submit: createRhartImageG2OfficialImageToImage,
  },
  {
    key: "n-pro",
    title: "全能图片PRO-图生图-低价渠道版",
    defaultPrompt: "基于原图风格，将主体替换为一只年迈慈祥的猴子奶奶，她穿着格子围裙，正用香蕉制作晚餐。环境保持不变，风格为手绘水彩插画，色彩柔和，细节丰富。",
    defaultImageUrls: [],
    defaultAspectRatio: "3:4",
    defaultResolution: "1k",
    hasQuality: false,
    submit: createRhartImageNProEdit,
  },
  {
    key: "n-pro-official",
    title: "全能图片PRO-图生图-官方稳定版",
    defaultPrompt: "海边沙滩变成夏日祭典现场：猴子戴着纸折小帽，小香蕉插着蜡烛当作生日蛋糕，周围有彩旗、西瓜、贝壳风铃。风格欢乐卡通，色彩缤纷。",
    defaultImageUrls: [],
    defaultAspectRatio: "3:4",
    defaultResolution: "1k",
    hasQuality: false,
    submit: createRhartImageNProOfficialEdit,
  },
];

const DEMO_LINKS = [
  { label: "视频消除 Demo", path: "/video/removal-demo" },
  { label: "本地视频上传 Demo", path: "/video/local-upload-demo" },
  { label: "RunningHub 工作流 Demo", path: "/video/runninghub-workflow-demo" },
  { label: "RunningHub 文生图 V2 Demo", path: "/video/runninghub-text-to-image-demo" },
];
