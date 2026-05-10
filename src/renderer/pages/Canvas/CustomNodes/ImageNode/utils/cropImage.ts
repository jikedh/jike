export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const getExpandedCanvasSize = (
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
) => {
  const safeSourceWidth = Math.max(1, Math.round(sourceWidth));
  const safeSourceHeight = Math.max(1, Math.round(sourceHeight));
  const sourceAspect = safeSourceWidth / safeSourceHeight;
  const safeTargetAspect =
    Number.isFinite(targetAspect) && targetAspect > 0
      ? Math.max(0.05, targetAspect)
      : sourceAspect;

  let width = safeSourceWidth;
  let height = safeSourceHeight;

  if (safeTargetAspect > sourceAspect) {
    width = Math.ceil(safeSourceHeight * safeTargetAspect);
  } else if (safeTargetAspect < sourceAspect) {
    height = Math.ceil(safeSourceWidth / safeTargetAspect);
  }

  return { width, height };
};

/**
 * 加载图片资源并等待图片就绪。
 * 这里显式设置 crossOrigin，尽量兼容 OSS 这类跨域图片地址。
 */
const loadImage = (imageSrc: string, crossOrigin?: "anonymous") => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) {
      image.crossOrigin = crossOrigin;
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));

    image.src = imageSrc;
  });
};

const loadCropSourceImage = async (imageSrc: string) => {
  try {
    return await loadImage(imageSrc, "anonymous");
  } catch {
    return loadImage(imageSrc);
  }
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
  const sourceImage = await loadCropSourceImage(imageSrc);

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
    try {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("裁剪结果生成失败"));
          return;
        }

        resolve(result);
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });

  return new File([blob], fileName, { type: "image/png" });
};

export const createExpandedImageFile = async (
  imageSrc: string,
  targetAspect: number,
  backgroundColor: string,
  fileName: string,
) => {
  const sourceImage = await loadCropSourceImage(imageSrc);
  const sourceWidth = Math.max(
    1,
    sourceImage.naturalWidth || sourceImage.width,
  );
  const sourceHeight = Math.max(
    1,
    sourceImage.naturalHeight || sourceImage.height,
  );
  const { width: outputWidth, height: outputHeight } = getExpandedCanvasSize(
    sourceWidth,
    sourceHeight,
    targetAspect,
  );

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建扩比画布");
  }

  context.fillStyle = backgroundColor || "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);

  context.drawImage(
    sourceImage,
    Math.round((outputWidth - sourceWidth) / 2),
    Math.round((outputHeight - sourceHeight) / 2),
    sourceWidth,
    sourceHeight,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("扩比结果生成失败"));
          return;
        }

        resolve(result);
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });

  return new File([blob], fileName, { type: "image/png" });
};
