/**
 * UploadTest 页面 - UploadOSS 预签名上传测试 Demo
 * 支持测试图片、视频、音频等多类型文件上传
 */
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { UploadOssBlobType, UploadOssPutUrlResp } from "shared/types/api/jikeGo";
import {
  getUploadOssPutUrl,
  uploadOssFile,
} from "@/api/jikeGo";

// 文件类型配置
const FILE_TYPE_CONFIG = {
  image: {
    label: "图片",
    accept: "image/jpeg,image/png,image/webp,image/gif,image/bmp",
    extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"],
    color: "bg-green-600 hover:bg-green-500",
  },
  video: {
    label: "视频",
    accept: "video/mp4,video/quicktime,video/webm",
    extensions: ["mp4", "mov", "webm"],
    color: "bg-blue-600 hover:bg-blue-500",
  },
  audio: {
    label: "音频",
    accept: "audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/flac",
    extensions: ["mp3", "wav", "ogg", "aac", "flac"],
    color: "bg-purple-600 hover:bg-purple-500",
  },
} as const;

// 上传记录类型
interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: string;
  blobType: UploadOssBlobType;
  method: "presigned" | "direct";
  status: "uploading" | "success" | "error";
  accessUrl?: string;
  error?: string;
  timestamp: string;
}

export default function UploadTestPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 添加上传记录
  const addRecord = (record: UploadRecord) => {
    setRecords((prev) => [record, ...prev]);
  };

  // 更新上传记录状态
  const updateRecord = (id: string, update: Partial<UploadRecord>) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...update } : r)),
    );
  };

  // 获取文件扩展名
  const getFileExt = (filename: string) => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ========== 预签名上传方式 ==========
  const handlePresignedUpload = async (
    blobType: UploadOssBlobType,
    file: File,
  ) => {
    const recordId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ext = getFileExt(file.name);

    addRecord({
      id: recordId,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      blobType,
      method: "presigned",
      status: "uploading",
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      // 步骤1: 获取预签名上传地址
      console.log(`[预签名上传] 获取 ${blobType} 上传地址...`);
      const resp = await getUploadOssPutUrl({
        blob_type: blobType,
        ext,
      });
      const putUrlData: UploadOssPutUrlResp = resp?.data || resp;
      console.log("[预签名上传] 响应:", putUrlData);

      if (!putUrlData?.put_url) {
        throw new Error("未获取到预签名 URL");
      }

      // 步骤2: 使用预签名 URL 直接 PUT 上传
      console.log("[预签名上传] 开始上传文件...");
      const arrayBuffer = await file.arrayBuffer();

      const uploadResp = await fetch(putUrlData.put_url, {
        method: "PUT",
        body: arrayBuffer,
        headers: putUrlData.headers || {},
      });

      if (!uploadResp.ok) {
        const errText = await uploadResp.text().catch(() => "");
        throw new Error(
          `上传失败: ${uploadResp.status} ${uploadResp.statusText} ${errText}`,
        );
      }

      console.log("[预签名上传] 上传成功:", putUrlData.access_url);
      updateRecord(recordId, {
        status: "success",
        accessUrl: putUrlData.access_url,
      });
    } catch (error: any) {
      console.error("[预签名上传] 失败:", error);
      updateRecord(recordId, {
        status: "error",
        error: error?.message || "未知错误",
      });
    }
  };

  // ========== 服务端直传方式 ==========
  const handleDirectUpload = async (
    blobType: UploadOssBlobType,
    file: File,
  ) => {
    const recordId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    addRecord({
      id: recordId,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      blobType,
      method: "direct",
      status: "uploading",
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      console.log(`[服务端上传] 上传 ${file.name}...`);
      const resp = await uploadOssFile(file);
      const data = resp?.data || resp;
      console.log("[服务端上传] 响应:", data);

      updateRecord(recordId, {
        status: "success",
        accessUrl: data?.url || data?.URL,
      });
    } catch (error: any) {
      console.error("[服务端上传] 失败:", error);
      updateRecord(recordId, {
        status: "error",
        error: error?.message || "未知错误",
      });
    }
  };

  // 触发文件选择
  const triggerFileSelect = (
    blobType: UploadOssBlobType,
    method: "presigned" | "direct",
  ) => {
    const key = `${blobType}-${method}`;
    const input = fileInputRefs.current[key];
    if (input) {
      // 清空 value 以便重复选择相同文件
      input.value = "";
      input.click();
    }
  };

  // 文件选择回调
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    blobType: UploadOssBlobType,
    method: "presigned" | "direct",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (method === "presigned") {
      handlePresignedUpload(blobType, file);
    } else {
      handleDirectUpload(blobType, file);
    }
  };

  // 清空记录
  const clearRecords = () => setRecords([]);

  // 预览组件
  const renderPreview = (record: UploadRecord) => {
    if (!record.accessUrl) return null;

    if (record.blobType === "image") {
      return (
        <img
          src={record.accessUrl}
          alt={record.fileName}
          className="mt-2 max-w-xs max-h-40 rounded-lg object-contain"
        />
      );
    }
    if (record.blobType === "video") {
      return (
        <video
          src={record.accessUrl}
          controls
          className="mt-2 max-w-xs max-h-40 rounded-lg"
        />
      );
    }
    if (record.blobType === "audio") {
      return <audio src={record.accessUrl} controls className="mt-2 w-full" />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-3xl">
        {/* 标题 */}
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-2xl font-bold">UploadOSS 上传测试</h1>
          <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-400">
            zhaojingnan bucket
          </span>
        </div>

        {/* 预签名上传区域 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-blue-400">
            预签名 URL 上传（客户端直传 OSS）
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            调用后端 POST /v1/oss/upload-put-url 获取预签名 URL，前端直接 PUT
            上传到 OSS
          </p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(FILE_TYPE_CONFIG) as UploadOssBlobType[]).map(
              (type) => {
                const config = FILE_TYPE_CONFIG[type];
                return (
                  <div key={`presigned-${type}`}>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[`${type}-presigned`] = el;
                      }}
                      type="file"
                      accept={config.accept}
                      className="hidden"
                      onChange={(e) => handleFileChange(e, type, "presigned")}
                    />
                    <Button
                      onClick={() => triggerFileSelect(type, "presigned")}
                      className={config.color}
                    >
                      上传{config.label}
                    </Button>
                  </div>
                );
              },
            )}
          </div>
        </section>

        {/* 服务端直传区域 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-amber-400">
            服务端中转上传
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            调用后端 POST /v1/oss/upload，前端 POST 文件到后端，后端转存到 OSS
          </p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(FILE_TYPE_CONFIG) as UploadOssBlobType[]).map(
              (type) => {
                const config = FILE_TYPE_CONFIG[type];
                return (
                  <div key={`direct-${type}`}>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[`${type}-direct`] = el;
                      }}
                      type="file"
                      accept={config.accept}
                      className="hidden"
                      onChange={(e) => handleFileChange(e, type, "direct")}
                    />
                    <Button
                      onClick={() => triggerFileSelect(type, "direct")}
                      variant="blue"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      上传{config.label}（中转）
                    </Button>
                  </div>
                );
              },
            )}
          </div>
        </section>

        {/* 上传记录 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">上传记录</h2>
            {records.length > 0 && (
              <Button
                onClick={clearRecords}
                variant="ghost"
                className="text-xs text-gray-500 hover:text-white"
              >
                清空记录
              </Button>
            )}
          </div>

          {records.length === 0 ? (
            <p className="text-sm text-gray-600">暂无上传记录</p>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* 状态指示 */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${record.status === "uploading"
                              ? "bg-yellow-400 animate-pulse"
                              : record.status === "success"
                                ? "bg-green-400"
                                : "bg-red-400"
                            }`}
                        />
                        <span className="text-sm font-medium truncate">
                          {record.fileName}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">
                          {record.fileSize}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span
                          className={`px-1.5 py-0.5 rounded ${record.method === "presigned"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-amber-500/20 text-amber-400"
                            }`}
                        >
                          {record.method === "presigned" ? "预签名" : "服务端"}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/10">
                          {FILE_TYPE_CONFIG[record.blobType]?.label ||
                            record.blobType}
                        </span>
                        <span>{record.timestamp}</span>
                      </div>

                      {/* 错误信息 */}
                      {record.error && (
                        <p className="mt-2 text-xs text-red-400">
                          {record.error}
                        </p>
                      )}

                      {/* 访问 URL */}
                      {record.accessUrl && (
                        <a
                          href={record.accessUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 break-all block"
                        >
                          {record.accessUrl}
                        </a>
                      )}

                      {/* 文件预览 */}
                      {record.status === "success" && renderPreview(record)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 导航按钮 */}
        <div className="flex flex-wrap gap-3 mt-8 pt-8 border-t border-white/10">
          <Button onClick={() => navigate("/video")} variant="blue">
            返回短片合成
          </Button>
          <Button onClick={() => navigate("/test-go")} variant="blue">
            TestGo 页面
          </Button>
        </div>
      </div>
    </div>
  );
}
