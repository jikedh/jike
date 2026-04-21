/**
 * 预签名 OSS 上传工具测试文件
 * 用于本地测试生成预签名 URL
 *
 * 直接使用 ali-oss 库，配置硬编码在文件内
 */

import OSS from "ali-oss";

// ========== 硬编码 OSS 配置 ==========
const OSS_CONFIG = {
  region: "oss-cn-hangzhou",
  accessKeyId: "LTAI5tP5KKCVWJMzMFUbwV9o",
  accessKeySecret: "mkhfB41Bd11AnIZRPcy3FqdOPQSeVA",
  bucket: "zhaojingnan",
};

// ========== 核心逻辑 ==========

/**
 * 获取 OSS 客户端实例（单例）
 */
function getOssClient() {
  return new OSS(OSS_CONFIG);
}

/**
 * 生成对象 key
 */
function buildObjectKey(options) {
  const directory = options.directory ?? "video";
  const extension = (options.extension ?? "mp4").replace(/^\./, "").toLowerCase();

  if (options.fileName?.trim()) {
    const pureName = options.fileName.replace(/\.[^/.]+$/, "").trim();
    return `${directory}/${pureName}.${extension}`;
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${directory}/${timestamp}-${random}.${extension}`;
}

/**
 * 生成 PUT 预签名上传目标
 */
async function createPresignedTarget(options = {}) {
  const client = getOssClient();
  const objectKey = buildObjectKey(options);
  const uploadHeaders = {};

  if (options.contentType) {
    uploadHeaders["Content-Type"] = options.contentType;
  }

  const uploadUrl = client.signatureUrl(objectKey, {
    method: "PUT",
    expires: options.expiresSeconds ?? 24 * 60 * 60,
    headers: uploadHeaders,
  });

  return {
    objectKey,
    uploadUrl,
    publicUrl: uploadUrl.split("?")[0],
    uploadHeaders,
  };
}

/**
 * 从预签名 URL 提取可公开访问的基础 URL
 */
function getPublicUrl(uploadUrl) {
  return uploadUrl.split("?")[0];
}

// ========== 测试逻辑 ==========

async function testPresignedUpload() {
  try {
    console.log("🚀 开始测试预签名 URL 生成...\n");
    console.log("📋 当前配置:");
    console.log("   region:", OSS_CONFIG.region);
    console.log("   bucket:", OSS_CONFIG.bucket);
    console.log("\n");

    // ========== 测试 1: 生成视频预签名 URL ==========
    console.log("📹 测试 1: 生成视频预签名 URL");
    console.log("参数: { directory: 'video', extension: 'mp4', fileName: 'test-video' }");

    const videoTarget = await createPresignedTarget({
      directory: "video",
      extension: "mp4",
      fileName: "test-video",
      contentType: "application/octet-stream",
    });

    console.log("✅ 生成成功！\n");
    console.log("📋 返回内容:");
    console.log("   objectKey:", videoTarget.objectKey);
    console.log("   uploadUrl:", videoTarget.uploadUrl);
    console.log("   publicUrl:", videoTarget.publicUrl);
    console.log("   uploadHeaders:", videoTarget.uploadHeaders);
    console.log("\n");

    // ========== 测试 2: 生成图片预签名 URL（自动生成文件名） ==========
    console.log("🖼️  测试 2: 生成图片预签名 URL（自动生成文件名）");
    console.log("参数: { directory: 'image', extension: 'jpg' }");

    const imageTarget = await createPresignedTarget({
      directory: "image",
      extension: "jpg",
      contentType: "image/jpeg",
    });

    console.log("✅ 生成成功！\n");
    console.log("📋 返回内容:");
    console.log("   objectKey:", imageTarget.objectKey);
    console.log("   uploadUrl:", imageTarget.uploadUrl);
    console.log("   publicUrl:", imageTarget.publicUrl);
    console.log("\n");

    // ========== 测试 3: 生成音频预签名 URL ==========
    console.log("🔊 测试 3: 生成音频预签名 URL");
    console.log("参数: { directory: 'audio', extension: 'mp3', fileName: 'song' }");

    const audioTarget = await createPresignedTarget({
      directory: "audio",
      extension: "mp3",
      fileName: "song",
      contentType: "audio/mpeg",
      expiresSeconds: 3600, // 1 小时过期
    });

    console.log("✅ 生成成功！\n");
    console.log("📋 返回内容:");
    console.log("   objectKey:", audioTarget.objectKey);
    console.log("   uploadUrl:", audioTarget.uploadUrl);
    console.log("   publicUrl:", audioTarget.publicUrl);
    console.log("   uploadHeaders:", audioTarget.uploadHeaders);
    console.log("\n");

    // ========== 测试 4: 提取公开 URL ==========
    console.log("🔗 测试 4: 从预签名 URL 提取公开 URL");
    const sampleSignedUrl =
      "https://bucket.oss-cn-hangzhou.aliyuncs.com/video/test.mp4?Signature=xxx&Expires=yyy";
    const publicUrl = getPublicUrl(sampleSignedUrl);

    console.log("   输入:", sampleSignedUrl);
    console.log("   输出:", publicUrl);
    console.log("\n");

    console.log("✨ 所有测试完成！");
  } catch (error) {
    console.error("❌ 测试出错:", error.message);
  }
}

// 运行测试
testPresignedUpload();
