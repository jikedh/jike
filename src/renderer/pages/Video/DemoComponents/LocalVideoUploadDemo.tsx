import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUploadOssPutUrl } from "@/api/jikeGo";
import { Button } from "@/components/ui/button";
const LocalVideoUploadDemo = () => {
    const navigate = useNavigate();
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
            return;
        }
        console.warn("请选择 MP4 格式的视频文件");
    };
    const handleFileUpload = async () => {
        if (!selectedFile) {
            console.warn("请先选择要上传的视频文件");
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        console.log("开始上传本地视频:", selectedFile.name);
        try {
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
                '';
            if (!presignedTarget?.put_url) {
                throw new Error("未获取到预签名上传地址");
            }
            console.log("预签名目标:", presignedTarget);
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
        } catch (error: any) {
            console.error("上传失败:", error);
        } finally {
            setUploading(false);
        }
    };
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
            <div className="max-w-xl space-y-4">
                <h1 className="text-2xl font-bold mb-6">本地视频上传 Demo</h1>
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
                <div className="pt-6 border-t border-white/10">
                    <Button onClick={() => navigate("/video")} variant="blue">
                        返回短片合成
                    </Button>
                </div>
            </div>
        </div>
    );
};
export default LocalVideoUploadDemo;
