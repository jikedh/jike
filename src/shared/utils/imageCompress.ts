const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export const compressImage = async (
  file: File,
  maxSize: number = MAX_IMAGE_SIZE,
): Promise<File> => {
  if (file.size <= maxSize) {
    return file;
  }

  console.log(
    `[压缩图片] 原始大小: ${(file.size / 1024 / 1024).toFixed(2)}MB，开始压缩...`,
  );

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const width = img.width;
      const height = img.height;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建 Canvas 上下文"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const tryCompress = (currentQuality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("图片压缩失败"));
              return;
            }

            if (blob.size <= maxSize || currentQuality <= 0.1) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              console.log(
                `[压缩图片] 压缩后大小: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
              );
              resolve(compressedFile);
              return;
            }

            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            tryCompress(currentQuality - 0.1);
          },
          "image/jpeg",
          currentQuality,
        );
      };

      tryCompress(0.8);
    };

    img.onerror = () => {
      reject(new Error("图片加载失败"));
    };

    img.src = URL.createObjectURL(file);
  });
};

export const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE;
