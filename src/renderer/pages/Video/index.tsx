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
  createRunningHubTask,
  getUploadOssPutUrl,
  pollRunningHubTask,
} from "@/api/jikeGo";

export default function VideoPage() {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [resultVideoUrl, setResultVideoUrl] = useState("");

  // 上传本地视频相关状态
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!videoUrl.trim()) {
      console.warn("请输入视频URL");
      return;
    }

    setLoading(true);
    console.log("开始视频消除流程...");
    console.log("视频URL:", videoUrl);

    try {
      // 步骤1: 获取预签名上传地址
      console.log("步骤1: 获取预签名上传地址...");
      const putUrlResponse = await getUploadOssPutUrl({
        blob_type: "video",
        ext: "mp4",
        content_type: "video/mp4",
        ttl: 43200,
      });
      const presignedTarget = putUrlResponse?.data ?? putUrlResponse;
      const accessUrl =
        presignedTarget?.access_url ||
        presignedTarget?.put_url?.split("?")[0] ||
        "";

      if (!presignedTarget?.put_url) {
        throw new Error("未获取到预签名上传地址");
      }

      console.log("预签名目标:", presignedTarget);

      // 步骤2: 调用视频消除接口
      console.log("步骤2: 调用视频消除接口...");
      const response: any = await videoRemoval({
        video_url: videoUrl,
        model: "video_removal_std",
        method: "sel_area",
        rect: {
          x1: 97,
          y1: 842,
          x2: 1633,
          y2: 1080,
        },
        upload_url: presignedTarget.put_url,
        upload_headers: presignedTarget.headers,
      });
      console.log("视频消除响应:", response);

      // 提取 task_id
      const id = response?.data?.task_id || response?.task_id;
      if (!id) {
        console.error("未获取到 task_id:", response);
        setLoading(false);
        return;
      }
      setTaskId(id);
      console.log("任务ID:", id);

      // 步骤3: 轮询任务状态
      console.log("步骤3: 开始轮询任务状态...");
      await pollTaskStatus(id, accessUrl);
    } catch (error) {
      console.error("视频消除流程出错:", error);
    } finally {
      setLoading(false);
    }
  };

  // 轮询任务状态
  const pollTaskStatus = async (id: string, publicUrl: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      console.log(`轮询尝试 ${attempts}/${maxAttempts}`);

      try {
        const statusResponse: any = await getVideoRemovalStatus(id);
        console.log(
          `[${new Date().toLocaleTimeString()}] 任务状态:`,
          statusResponse,
        );

        const taskStatus =
          statusResponse?.data?.task_status || statusResponse?.task_status;
        const progress =
          statusResponse?.data?.progress || statusResponse?.progress;

        if (
          taskStatus === "SUCCEEDED" ||
          taskStatus === "COMPLETED" ||
          progress === 100
        ) {
          console.log("任务完成，最终状态:", taskStatus, "进度:", progress);
          console.log("公开访问视频URL:", publicUrl);
          setResultVideoUrl(publicUrl);
          return;
        }

        if (taskStatus === "FAILED") {
          console.log("任务失败:", taskStatus);
          return;
        }
      } catch (error) {
        console.error(`轮询出错 (${attempts}):`, error);
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 3000);
      } else {
        console.warn("达到最大轮询次数，停止轮询");
      }
    };

    await poll();
  };

  // 处理本地文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "video/mp4") {
      setSelectedFile(file);
      console.log(
        "已选择文件:",
        file.name,
        "大小:",
        (file.size / 1024 / 1024).toFixed(2),
        "MB",
      );
    } else {
      console.warn("请选择 MP4 格式的视频文件");
    }
  };

  // 上传本地视频到 OSS
  const handleFileUpload = async () => {
    if (!selectedFile) {
      console.warn("请先选择要上传的视频文件");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    console.log("开始上传本地视频:", selectedFile.name);

    try {
      // 步骤1: 获取预签名上传地址
      console.log("步骤1: 获取预签名上传地址...");
      const putUrlResponse = await getUploadOssPutUrl({
        blob_type: "video",
        ext: "mp4",
        content_type: selectedFile.type || "video/mp4",
      });
      const presignedTarget = putUrlResponse?.data ?? putUrlResponse;
      const accessUrl =
        presignedTarget?.access_url ||
        presignedTarget?.put_url?.split("?")[0] ||
        "";

      if (!presignedTarget?.put_url) {
        throw new Error("未获取到预签名上传地址");
      }

      console.log("预签名目标:", presignedTarget);

      // 步骤2: 使用预签名地址上传文件
      console.log("步骤2: 开始上传文件...");
      setUploadProgress(30);

      const arrayBuffer = await selectedFile.arrayBuffer();
      setUploadProgress(60);

      const uploadResponse = await fetch(presignedTarget.put_url, {
        method: "PUT",
        body: arrayBuffer,
        headers: presignedTarget.headers || {},
      });

      if (!uploadResponse.ok) {
        const message = await uploadResponse.text().catch(() => "");
        throw new Error(
          `上传失败: ${uploadResponse.status} ${uploadResponse.statusText}${message ? ` - ${message}` : ""
          }`,
        );
      }

      setUploadProgress(100);
      console.log("上传完成，公开访问URL:", accessUrl);
      setUploadedVideoUrl(accessUrl);
    } catch (error) {
      console.error("上传失败:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <h1 className="text-2xl font-bold mb-6">视频消除 Demo</h1>

      <div className="max-w-xl space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">视频 URL</label>
          <Input
            placeholder="请输入视频URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <Button onClick={handleSubmit} disabled={loading} variant="blue">
          {loading ? "处理中..." : "提交视频消除任务"}
        </Button>

        {taskId && (
          <p className="text-sm text-gray-400">当前任务ID: {taskId}</p>
        )}

        {resultVideoUrl && (
          <div className="mt-4 p-4 bg-white/5 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">处理完成视频URL:</p>
            <a
              href={resultVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm break-all"
            >
              {resultVideoUrl}
            </a>
            <video
              src={resultVideoUrl}
              controls
              className="mt-3 w-full max-w-lg rounded-lg"
            />
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          <p>操作说明：</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>输入视频URL（支持公网可访问的视频链接）</li>
            <li>点击提交后会自动获取预签名上传地址</li>
            <li>调用视频消除接口并获取task_id</li>
            <li>每3秒轮询一次任务状态，结果打印在控制台</li>
          </ol>
        </div>
      </div>

      {/* ========== 本地视频上传 Demo ========== */}
      <div className="max-w-xl space-y-4 mt-8 pt-8 border-t border-white/10">
        <h2 className="text-xl font-bold mb-4">本地视频上传 Demo</h2>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            选择 MP4 视频文件
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
          />
        </div>

        {selectedFile && (
          <div className="text-sm text-gray-400">
            已选择: {selectedFile.name} (
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        <Button
          onClick={handleFileUpload}
          disabled={uploading || !selectedFile}
          variant="blue"
        >
          {uploading ? `上传中... ${uploadProgress}%` : "上传视频到 OSS"}
        </Button>

        {uploading && (
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {uploadedVideoUrl && (
          <div className="mt-4 p-4 bg-white/5 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">
              上传成功，公开访问视频URL:
            </p>
            <a
              href={uploadedVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm break-all"
            >
              {uploadedVideoUrl}
            </a>
            <video
              src={uploadedVideoUrl}
              controls
              className="mt-3 w-full max-w-lg rounded-lg"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/test")} variant="blue">
            跳转到测试页面
          </Button>
          <Button onClick={() => navigate("/test-go")} variant="blue">
            跳转到测试-GO页面
          </Button>
          <Button onClick={() => navigate("/video/upload-test")} variant="blue">
            UploadOSS 上传测试
          </Button>
        </div>
      </div>

      {/* ========== RunningHub 工作流 Demo ========== */}
      <RunningHubWorkflowDemo />
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
