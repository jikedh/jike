export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 加载图片资源并等待图片就绪。
 * 这里显式设置 crossOrigin，尽量兼容 OSS 这类跨域图片地址。
 */
const loadImage = (imageSrc: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));

    image.src = imageSrc;
  });
};

/**
 * 根据裁剪区域生成新的图片文件。
 * 这里直接使用 Canvas 进行像素级裁剪，输出 png 文件，方便后续复用现有 OSS 上传流程。
 */
export const createCroppedImageFile = async (
  imageSrc: string,
  cropArea: CropArea,
  fileName: string,
) => {
  const sourceImage = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  const croppedWidth = Math.max(1, Math.round(cropArea.width));
  const croppedHeight = Math.max(1, Math.round(cropArea.height));

  canvas.width = croppedWidth;
  canvas.height = croppedHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建裁剪画布");
  }

  context.drawImage(
    sourceImage,
    Math.round(cropArea.x),
    Math.round(cropArea.y),
    croppedWidth,
    croppedHeight,
    0,
    0,
    croppedWidth,
    croppedHeight,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("裁剪结果生成失败"));
        return;
      }

      resolve(result);
    }, "image/png");
  });

  return new File([blob], fileName, { type: "image/png" });
};
