import * as THREE from "three";

export type LightingType = "soft" | "hard";

export type LightingConfig = {
  presetId: string;
  lightType: LightingType;
  intensity: number;
  color: string;
  sceneAngle: number;
  horizontalAngle: number;
  pitchAngle: number;
  rotationY?: number;
};

export type LightingPreset = LightingConfig & {
  name: string;
  description: string;
};

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  presetId: "natural-light",
  lightType: "soft",
  intensity: 48,
  color: "#fff1d0",
  sceneAngle: 0,
  horizontalAngle: -18,
  pitchAngle: 18,
  rotationY: 0,
};

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    presetId: "three-point",
    name: "三点布光",
    description: "均衡主光与轻轮廓",
    lightType: "soft",
    intensity: 58,
    color: "#fff2d7",
    sceneAngle: 12,
    horizontalAngle: -28,
    pitchAngle: 20,
  },
  {
    presetId: "rembrandt",
    name: "伦勃朗布光",
    description: "斜侧暖光与深阴影",
    lightType: "hard",
    intensity: 66,
    color: "#ffd39a",
    sceneAngle: -8,
    horizontalAngle: -52,
    pitchAngle: 24,
  },
  {
    presetId: "split-light",
    name: "分割光",
    description: "强侧光切分明暗",
    lightType: "hard",
    intensity: 72,
    color: "#f7f3ec",
    sceneAngle: 0,
    horizontalAngle: -82,
    pitchAngle: 6,
  },
  {
    presetId: "top-drama",
    name: "顶光戏剧",
    description: "高位压迫明暗",
    lightType: "hard",
    intensity: 68,
    color: "#f6f8ff",
    sceneAngle: 0,
    horizontalAngle: 0,
    pitchAngle: 56,
  },
  {
    presetId: "anime-soft",
    name: "动漫柔光",
    description: "轻柔漫射高饱和",
    lightType: "soft",
    intensity: 42,
    color: "#ffe5f0",
    sceneAngle: 18,
    horizontalAngle: -20,
    pitchAngle: 28,
  },
  {
    presetId: "cyberpunk",
    name: "赛博朋克",
    description: "蓝紫霓虹对比",
    lightType: "hard",
    intensity: 76,
    color: "#4cd8ff",
    sceneAngle: 32,
    horizontalAngle: 48,
    pitchAngle: -8,
  },
  {
    presetId: "natural-light",
    name: "自然光",
    description: "日常柔和窗光",
    lightType: "soft",
    intensity: 48,
    color: "#fff1d0",
    sceneAngle: 0,
    horizontalAngle: -18,
    pitchAngle: 18,
  },
  {
    presetId: "golden-hour",
    name: "黄金时刻",
    description: "低角度金色暖光",
    lightType: "soft",
    intensity: 62,
    color: "#ffb45d",
    sceneAngle: -18,
    horizontalAngle: -58,
    pitchAngle: -18,
  },
  {
    presetId: "blue-hour",
    name: "蓝调时刻",
    description: "冷蓝余晖与低反差",
    lightType: "soft",
    intensity: 44,
    color: "#8bb6ff",
    sceneAngle: 8,
    horizontalAngle: 32,
    pitchAngle: -12,
  },
  {
    presetId: "high-key",
    name: "高调光",
    description: "通透明亮低阴影",
    lightType: "soft",
    intensity: 70,
    color: "#ffffff",
    sceneAngle: 0,
    horizontalAngle: -8,
    pitchAngle: 34,
  },
  {
    presetId: "low-key",
    name: "低调光",
    description: "低曝光强氛围",
    lightType: "hard",
    intensity: 54,
    color: "#d9e7ff",
    sceneAngle: 0,
    horizontalAngle: -40,
    pitchAngle: 10,
  },
  {
    presetId: "rim-light",
    name: "轮廓光",
    description: "背侧轮廓提亮",
    lightType: "hard",
    intensity: 64,
    color: "#e9f3ff",
    sceneAngle: 180,
    horizontalAngle: 78,
    pitchAngle: 12,
  },
  {
    presetId: "silhouette",
    name: "剪影",
    description: "背光压暗主体",
    lightType: "hard",
    intensity: 80,
    color: "#fff0c7",
    sceneAngle: 180,
    horizontalAngle: 0,
    pitchAngle: -8,
  },
  {
    presetId: "neon",
    name: "霓虹灯",
    description: "彩色边缘闪耀",
    lightType: "hard",
    intensity: 74,
    color: "#ff4fd8",
    sceneAngle: 38,
    horizontalAngle: 62,
    pitchAngle: 4,
  },
  {
    presetId: "practical",
    name: "实景光",
    description: "室内灯源柔暖",
    lightType: "soft",
    intensity: 50,
    color: "#ffd188",
    sceneAngle: -22,
    horizontalAngle: 24,
    pitchAngle: 10,
  },
  {
    presetId: "chiaroscuro",
    name: "明暗对比",
    description: "古典强反差",
    lightType: "hard",
    intensity: 78,
    color: "#f7c681",
    sceneAngle: -12,
    horizontalAngle: -62,
    pitchAngle: 20,
  },
  {
    presetId: "campfire",
    name: "篝火光",
    description: "低位橙红跳跃感",
    lightType: "soft",
    intensity: 60,
    color: "#ff7b34",
    sceneAngle: -28,
    horizontalAngle: -18,
    pitchAngle: -48,
  },
  {
    presetId: "moon-night",
    name: "月夜神秘",
    description: "冷色顶侧微光",
    lightType: "soft",
    intensity: 46,
    color: "#9db7ff",
    sceneAngle: 18,
    horizontalAngle: 38,
    pitchAngle: 34,
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const POINT_RANGE = 0.42;
const HORIZONTAL_RANGE = 110;
const PITCH_RANGE = 70;
const SCENE_POINT_FACTOR = 0.25;
const ROTATION_Y_RANGE = 60;

type RendererEntry = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
};

const rendererCache = new WeakMap<HTMLCanvasElement, RendererEntry>();
const BACKGROUND_RGB = { r: 7, g: 7, b: 10 };

const loadImage = (imageSrc: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = imageSrc;
  });
};

const getRenderer = (canvas: HTMLCanvasElement) => {
  const cachedEntry = rendererCache.get(canvas);
  if (cachedEntry) {
    return cachedEntry;
  }

  const renderCanvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas: renderCanvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const entry = { canvas: renderCanvas, renderer };
  rendererCache.set(canvas, entry);
  return entry;
};

export const disposeLightingRenderer = (canvas: HTMLCanvasElement) => {
  const entry = rendererCache.get(canvas);
  if (!entry) {
    return;
  }

  entry.renderer.dispose();
  entry.renderer.forceContextLoss();
  rendererCache.delete(canvas);
};

const disposeObject3D = (object: THREE.Object3D) => {
  object.traverse((item) => {
    if (item instanceof THREE.Mesh) {
      item.geometry.dispose();
      const materials = Array.isArray(item.material)
        ? item.material
        : [item.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        });
        material.dispose();
      });
    }
  });
};

const getRotationY = (config: LightingConfig) =>
  clamp(config.rotationY ?? 0, -ROTATION_Y_RANGE, ROTATION_Y_RANGE);

export const getLightingPoint = (config: LightingConfig) => {
  const horizontal = clamp(
    config.horizontalAngle + config.sceneAngle * SCENE_POINT_FACTOR,
    -HORIZONTAL_RANGE,
    HORIZONTAL_RANGE,
  );
  const pitch = clamp(config.pitchAngle, -PITCH_RANGE, PITCH_RANGE);

  return {
    x: clamp(0.5 + (horizontal / HORIZONTAL_RANGE) * POINT_RANGE, 0.06, 0.94),
    y: clamp(0.5 - (pitch / PITCH_RANGE) * POINT_RANGE, 0.06, 0.94),
  };
};

export const getLightingConfigFromPoint = (
  config: LightingConfig,
  point: { x: number; y: number },
): LightingConfig => {
  const horizontal =
    ((clamp(point.x, 0.06, 0.94) - 0.5) / POINT_RANGE) * HORIZONTAL_RANGE;
  const pitch =
    ((0.5 - clamp(point.y, 0.06, 0.94)) / POINT_RANGE) * PITCH_RANGE;

  return {
    ...config,
    presetId: "custom",
    horizontalAngle: Math.round(
      clamp(
        horizontal - config.sceneAngle * SCENE_POINT_FACTOR,
        -HORIZONTAL_RANGE,
        HORIZONTAL_RANGE,
      ),
    ),
    pitchAngle: Math.round(clamp(pitch, -PITCH_RANGE, PITCH_RANGE)),
  };
};

const getOutputSize = (
  image: HTMLImageElement,
  maxSide: number | undefined,
) => {
  const naturalWidth = Math.max(1, image.naturalWidth || image.width);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height);

  if (!maxSide || Math.max(naturalWidth, naturalHeight) <= maxSide) {
    return { width: naturalWidth, height: naturalHeight };
  }

  const scale = maxSide / Math.max(naturalWidth, naturalHeight);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
};

const isBackgroundLike = (data: Uint8ClampedArray, index: number) => {
  const alpha = data[index + 3];
  if (alpha < 8) {
    return true;
  }

  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const diff =
    Math.abs(r - BACKGROUND_RGB.r) +
    Math.abs(g - BACKGROUND_RGB.g) +
    Math.abs(b - BACKGROUND_RGB.b);
  return diff < 30;
};

const trimBackgroundMargins = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return;
  }

  const { width, height } = canvas;
  if (width <= 1 || height <= 1) {
    return;
  }

  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (isBackgroundLike(data, index)) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return;
  }

  const padding = 2;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const trimWidth = maxX - minX + 1;
  const trimHeight = maxY - minY + 1;
  if (
    trimWidth >= width * 0.985 &&
    trimHeight >= height * 0.985
  ) {
    return;
  }

  const trimmed = context.getImageData(minX, minY, trimWidth, trimHeight);
  canvas.width = trimWidth;
  canvas.height = trimHeight;
  context.putImageData(trimmed, 0, 0);
};

export const renderLightingToCanvas = (
  image: HTMLImageElement,
  config: LightingConfig,
  canvas: HTMLCanvasElement,
  options: { maxSide?: number } = {},
) => {
  const { width, height } = getOutputSize(image, options.maxSide);
  canvas.width = width;
  canvas.height = height;

  const intensity = clamp(config.intensity, 0, 100) / 100;
  const hard = config.lightType === "hard";
  const rendererEntry = getRenderer(canvas);
  const { renderer } = rendererEntry;
  renderer.setSize(width, height, false);
  renderer.setClearColor(new THREE.Color("#07070a"), 1);

  const scene = new THREE.Scene();
  const aspect = width / height;
  const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
  const planeHeight = 2;
  const planeWidth = planeHeight * aspect;
  const cameraDistance =
    planeHeight / (2 * Math.tan(THREE.MathUtils.degToRad(35) / 2)) * 1.18;
  camera.position.set(0, 0, cameraDistance);
  camera.lookAt(0, 0, 0);

  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 96, 96);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: hard ? 0.48 : 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(
    0,
    THREE.MathUtils.degToRad(getRotationY(config)),
    0,
  );
  scene.add(mesh);

  const ambientLight = new THREE.AmbientLight(
    "#ffffff",
    hard ? 0.58 : 0.78,
  );
  scene.add(ambientLight);

  const lightPoint = getLightingPoint(config);
  const lightX = (lightPoint.x - 0.5) * planeWidth * 2.2;
  const lightY = (0.5 - lightPoint.y) * planeHeight * 2.2;
  const lightZ = 2.5 + Math.max(0, config.pitchAngle) / 35;
  const lightColor = new THREE.Color(config.color);
  const directionalLight = new THREE.DirectionalLight(
    lightColor,
    (hard ? 2.2 : 1.65) * intensity,
  );
  directionalLight.position.set(lightX, lightY, lightZ);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(
    lightColor,
    (hard ? 7.5 : 5.2) * intensity,
    6,
    hard ? 1.8 : 1.25,
  );
  pointLight.position.set(lightX, lightY, 2.2);
  scene.add(pointLight);

  const rimLight = new THREE.DirectionalLight(
    "#dbe8ff",
    hard ? 0.36 * intensity : 0.2 * intensity,
  );
  rimLight.position.set(-lightX, -lightY, -2.8);
  scene.add(rimLight);

  renderer.render(scene, camera);
  disposeObject3D(scene);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("无法创建灯光输出画布");
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(rendererEntry.canvas, 0, 0, width, height);
  trimBackgroundMargins(canvas);
};

export const createLightingImageFile = async (
  imageSrc: string,
  config: LightingConfig,
  fileName: string,
) => {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  try {
    renderLightingToCanvas(image, config, canvas, { maxSide: 4096 });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("灯光图片生成失败"));
          return;
        }

        resolve(result);
      }, "image/png");
    });

    return new File([blob], fileName, { type: "image/png" });
  } finally {
    disposeLightingRenderer(canvas);
  }
};

export const loadLightingImage = loadImage;
