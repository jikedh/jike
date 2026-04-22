/**
 * Video 页面 - 视频消除功能 Demo
 */
import { useState } from "react";
// import { Input } from "~/components/ui/input";
// import { Button } from "~/components/ui/button";
// import { videoRemoval, getVideoRemovalStatus } from "~/api/ai";
import { PresignedOssUploader } from "shared/utils/presignedOssUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getVideoRemovalStatus, videoRemoval } from "@/api/ai";

export default function VideoPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [resultVideoUrl, setResultVideoUrl] = useState("");

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
      const presignedTarget = await PresignedOssUploader.createTarget({
        directory: "video",
        extension: "mp4",
      });
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
        upload_url: presignedTarget.uploadUrl,
        upload_headers: { "Content-Type": "application/octet-stream" },
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
      await pollTaskStatus(id, presignedTarget.publicUrl);
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
        console.log(`[${new Date().toLocaleTimeString()}] 任务状态:`, statusResponse);

        const taskStatus = statusResponse?.data?.task_status || statusResponse?.task_status;
        const progress = statusResponse?.data?.progress || statusResponse?.progress;

        if (taskStatus === "SUCCEEDED" || taskStatus === "COMPLETED" || progress === 100) {
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
    </div>
  );
}
