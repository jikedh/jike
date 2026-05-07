/**
 * Video 页面 - 视频消除功能 Demo
 */
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
// import { Input } from "~/components/ui/input";
// import { Button } from "~/components/ui/button";
// import { videoRemoval, getVideoRemovalStatus } from "~/api/ai";
import { PresignedOssUploader } from "shared/utils/presignedOssUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getVideoRemovalStatus, videoRemoval } from "@/api/ai";

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
      const presignedTarget = await PresignedOssUploader.createTarget({
        directory: "video",
        extension: "mp4",
        contentType: "application/octet-stream",
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
      const presignedTarget = await PresignedOssUploader.createTarget({
        directory: "video",
        extension: "mp4",
      });
      console.log("预签名目标:", presignedTarget);

      // 步骤2: 使用预签名地址上传文件
      console.log("步骤2: 开始上传文件...");
      setUploadProgress(30);

      const arrayBuffer = await selectedFile.arrayBuffer();
      setUploadProgress(60);

      await PresignedOssUploader.upload({
        target: presignedTarget,
        data: arrayBuffer,
        // 不设置 contentType，让 OSS 根据扩展名自动判断
      });

      setUploadProgress(100);
      console.log("上传完成，公开访问URL:", presignedTarget.publicUrl);
      setUploadedVideoUrl(presignedTarget.publicUrl);
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
        </div>
      </div>
    </div>
  );
}
