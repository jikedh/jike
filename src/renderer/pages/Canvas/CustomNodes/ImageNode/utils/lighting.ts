import * as THREE from "three";

export type LightingType = "soft" | "hard";
export type LightingViewMode = "perspective" | "front";
export type LightingDirection =
  | "left"
  | "top"
  | "right"
  | "front"
  | "bottom"
  | "back";

export type LightingVector3 = {
  x: number;
  y: number;
  z: number;
};

export type LightingProjection = {
  x: number;
  y: number;
  depth: number;
};

export type LightingConfig = {
  presetId: string;
  lightType: LightingType;
  intensity: number;
  color: string;
  viewMode: LightingViewMode;
  lightDirection: LightingDirection;
  rimLightEnabled: boolean;
  sceneAngle: number;
  horizontalAngle: number;
  pitchAngle: number;
  rotationY?: number;
  lightVector?: LightingVector3;
  rimLightVector?: LightingVector3;
};

export type LightingGenerationConfig = LightingConfig & {
  smartMode?: boolean;
  aiPrompt?: string;
  referenceImageUrl?: string;
  referenceLightingPrompt?: string;
  model: string;
  platform?: string;
  size?: string;
  resolution?: string;
};

export type LightingPreset = LightingConfig & {
  name: string;
  description: string;
};

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  presetId: "custom",
  lightType: "soft",
  intensity: 50,
  color: "#ffffff",
  viewMode: "front",
  lightDirection: "left",
  rimLightEnabled: false,
  sceneAngle: 0,
  horizontalAngle: -56,
  pitchAngle: 12,
  rotationY: 0,
  lightVector: { x: -0.74, y: 0.2, z: 0.64 },
  rimLightVector: { x: 0.36, y: 0.28, z: -0.89 },
};

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    presetId: "overexposed-film",
    name: "过曝胶片",
    description: "高亮低阴影，胶片泛白",
    lightType: "soft",
    intensity: 74,
    color: "#fff7df",
    viewMode: "perspective",
    lightDirection: "front",
    rimLightEnabled: false,
    sceneAngle: 0,
    horizontalAngle: 0,
    pitchAngle: 24,
    rotationY: 0,
  },
  {
    presetId: "blue-backlight",
    name: "蓝色逆光",
    description: "冷蓝背光，边缘发亮",
    lightType: "hard",
    intensity: 68,
    color: "#62b7ff",
    viewMode: "perspective",
    lightDirection: "back",
    rimLightEnabled: true,
    sceneAngle: 180,
    horizontalAngle: 18,
    pitchAngle: 8,
    rotationY: 0,
  },
  {
    presetId: "rembrandt",
    name: "伦勃朗光",
    description: "斜侧暖光，三角高光",
    lightType: "hard",
    intensity: 66,
    color: "#ffd39a",
    viewMode: "perspective",
    lightDirection: "left",
    rimLightEnabled: false,
    sceneAngle: -8,
    horizontalAngle: -52,
    pitchAngle: 24,
    rotationY: 0,
  },
  {
    presetId: "cyberpunk",
    name: "赛博朋克",
    description: "蓝紫霓虹，高反差",
    lightType: "hard",
    intensity: 76,
    color: "#4cd8ff",
    viewMode: "perspective",
    lightDirection: "right",
    rimLightEnabled: true,
    sceneAngle: 32,
    horizontalAngle: 48,
    pitchAngle: -8,
    rotationY: 0,
  },
  {
    presetId: "sunset-haze",
    name: "落日迷幻",
    description: "橙粉低角度，微眩光",
    lightType: "soft",
    intensity: 62,
    color: "#ff9b5f",
    viewMode: "perspective",
    lightDirection: "left",
    rimLightEnabled: true,
    sceneAngle: -18,
    horizontalAngle: -58,
    pitchAngle: -18,
    rotationY: 0,
  },
  {
    presetId: "mystic-low-key",
    name: "神秘暗调",
    description: "低曝光，冷色强阴影",
    lightType: "hard",
    intensity: 46,
    color: "#9db7ff",
    viewMode: "perspective",
    lightDirection: "top",
    rimLightEnabled: false,
    sceneAngle: 18,
    horizontalAngle: -36,
    pitchAngle: 30,
    rotationY: 0,
  },
  {
    presetId: "golden-hour",
    name: "黄金时刻",
    description: "金色暖光，柔和长阴影",
    lightType: "soft",
    intensity: 62,
    color: "#ffb45d",
    viewMode: "perspective",
    lightDirection: "left",
    rimLightEnabled: true,
    sceneAngle: -18,
    horizontalAngle: -58,
    pitchAngle: -18,
    rotationY: 0,
  },
  {
    presetId: "nolan-cool-gray",
    name: "诺兰冷灰",
    description: "冷灰主光，克制电影感",
    lightType: "hard",
    intensity: 56,
    color: "#c5cfdd",
    viewMode: "perspective",
    lightDirection: "front",
    rimLightEnabled: false,
    sceneAngle: 0,
    horizontalAngle: -18,
    pitchAngle: 12,
    rotationY: 0,
  },
];

export const LIGHTING_DIRECTION_LABELS: Record<LightingDirection, string> = {
  left: "左侧",
  top: "顶部",
  right: "右侧",
  front: "前方",
  bottom: "底部",
  back: "后方",
};

export const LIGHTING_DIRECTION_CONFIGS: Record<
  LightingDirection,
  Pick<LightingConfig, "sceneAngle" | "horizontalAngle" | "pitchAngle">
> = {
  left: { sceneAngle: 0, horizontalAngle: -56, pitchAngle: 12 },
  top: { sceneAngle: 0, horizontalAngle: 16, pitchAngle: 66 },
  right: { sceneAngle: 0, horizontalAngle: 54, pitchAngle: -7 },
  front: { sceneAngle: 0, horizontalAngle: -24, pitchAngle: -18 },
  bottom: { sceneAngle: 0, horizontalAngle: -16, pitchAngle: -64 },
  back: { sceneAngle: 180, horizontalAngle: 24, pitchAngle: 18 },
};

const LIGHTING_DIRECTION_VECTORS: Record<LightingDirection, LightingVector3> = {
  left: { x: -0.74, y: 0.2, z: 0.64 },
  top: { x: 0.12, y: 0.91, z: 0.4 },
  right: { x: 0.78, y: -0.12, z: 0.62 },
  front: { x: -0.36, y: -0.28, z: 0.89 },
  bottom: { x: -0.12, y: -0.9, z: 0.42 },
  back: { x: 0.36, y: 0.28, z: -0.89 },
};

const DEFAULT_RIM_LIGHT_VECTOR: LightingVector3 = LIGHTING_DIRECTION_VECTORS.back;

export const getLightingConfigForDirection = (
  config: LightingConfig,
  direction: LightingDirection,
): LightingConfig => ({
  ...config,
  lightDirection: direction,
  ...LIGHTING_DIRECTION_CONFIGS[direction],
  lightVector: LIGHTING_DIRECTION_VECTORS[direction],
  presetId: "custom",
});

const getLightingPresetName = (presetId: string) =>
  LIGHTING_PRESETS.find((preset) => preset.presetId === presetId)?.name ??
  "自定义光影";

const getLightDirectionText = (config: LightingConfig) => {
  const horizontal = clamp(config.horizontalAngle, -HORIZONTAL_RANGE, HORIZONTAL_RANGE);
  const pitch = clamp(config.pitchAngle, -PITCH_RANGE, PITCH_RANGE);
  const horizontalText =
    Math.abs(horizontal) < 12
      ? "画面正前方"
      : horizontal < 0
        ? "画面左侧"
        : "画面右侧";
  const pitchText =
    pitch > 22 ? "偏上方" : pitch < -18 ? "偏下方" : "平视高度";

  return `${horizontalText}${pitchText}`;
};

const getLightIntensityText = (intensity: number) => {
  if (intensity >= 72) {
    return "高强度";
  }
  if (intensity >= 46) {
    return "中等强度";
  }
  return "低强度";
};

const getColorTemperatureText = (color: string) => {
  const normalized = color.toLowerCase();
  if (
    normalized.includes("ff") &&
    (normalized.includes("b") || normalized.includes("c") || normalized.includes("d"))
  ) {
    return "偏暖色";
  }
  if (normalized.includes("8b") || normalized.includes("4c") || normalized.includes("9d")) {
    return "偏冷色";
  }
  return `颜色 ${color.toUpperCase()}`;
};

export const buildLightingPrompt = (config: LightingGenerationConfig) => {
  const presetName = getLightingPresetName(config.presetId);
  const lightTypeText = config.lightType === "hard" ? "硬光" : "柔光";
  const intensityText = getLightIntensityText(config.intensity);
  const directionText = getLightDirectionText(config);
  const colorText = getColorTemperatureText(config.color);
  const baseDirectionText =
    LIGHTING_DIRECTION_LABELS[config.lightDirection] ?? directionText;
  const rimLightText = config.rimLightEnabled
    ? "开启轮廓光，在主体边缘形成清晰但不过度的高光描边。"
    : "关闭轮廓光，边缘高光保持自然克制。";
  const rotationText =
    Math.abs(config.rotationY ?? 0) > 4
      ? `参考预览中的主体 Y 轴旋转倾向约 ${config.rotationY} 度。`
      : "";
  const userPrompt = config.aiPrompt?.trim();
  const referenceLightingPrompt = config.referenceLightingPrompt?.trim();
  const smartModeText = config.smartMode
    ? [
        userPrompt ? `用户智能描述：${userPrompt}` : "",
        referenceLightingPrompt
          ? `参考图灯光描述：${referenceLightingPrompt}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return [
    "基于当前原图进行光影重绘。保持主体身份、构图、姿态、服装、背景和画面比例不变，只调整布光、阴影、高光、反射和整体氛围。",
    `手动灯光参数：亮度 ${config.intensity}%，${colorText}${lightTypeText}，主光源方向为${baseDirectionText}（${directionText}），${rimLightText}${intensityText}。`,
    config.presetId !== "custom" ? `智能预设风格：${presetName}。` : "",
    rotationText,
    smartModeText,
    "不要改变主体结构，不要新增物体，不要添加文字、水印或多余细节。",
  ]
    .filter(Boolean)
    .join("\n");
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const LIGHTING_POINT_RANGE = 0.5;
const HORIZONTAL_RANGE = 110;
const PITCH_RANGE = 70;
const ROTATION_Y_RANGE = 60;

type RendererEntry = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
};

const rendererCache = new WeakMap<HTMLCanvasElement, RendererEntry>();
const BACKGROUND_RGB = { r: 7, g: 7, b: 10 };
const BRIGHTNESS_MATCH_MIN_INTENSITY = 0.45;
const BRIGHTNESS_MATCH_MAX_BOOST = 1.35;
const BRIGHTNESS_MATCH_MIN_GAP = 8;

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

const normalizeLightingVector = (vector: LightingVector3): LightingVector3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < 0.001) {
    return { x: 0, y: 0, z: 1 };
  }

  return {
    x: clamp(vector.x / length, -1, 1),
    y: clamp(vector.y / length, -1, 1),
    z: clamp(vector.z / length, -1, 1),
  };
};

const getLightingVectorFromAngles = (
  config: Pick<
    LightingConfig,
    "horizontalAngle" | "pitchAngle" | "sceneAngle" | "lightDirection"
  >,
): LightingVector3 => {
  const horizontal = clamp(
    config.horizontalAngle,
    -HORIZONTAL_RANGE,
    HORIZONTAL_RANGE,
  );
  const pitch = clamp(config.pitchAngle, -PITCH_RANGE, PITCH_RANGE);
  const yaw = THREE.MathUtils.degToRad(horizontal);
  const pitchRad = THREE.MathUtils.degToRad(pitch);
  const zSign =
    config.sceneAngle >= 90 || config.lightDirection === "back" ? -1 : 1;

  return normalizeLightingVector({
    x: Math.sin(yaw) * Math.cos(pitchRad),
    y: Math.sin(pitchRad),
    z: zSign * Math.max(0.12, Math.abs(Math.cos(yaw) * Math.cos(pitchRad))),
  });
};

export const getLightingVector = (config: LightingConfig): LightingVector3 => {
  if (config.lightVector) {
    return normalizeLightingVector(config.lightVector);
  }

  return getLightingVectorFromAngles(config);
};

export const getRimLightingVector = (
  config: LightingConfig,
): LightingVector3 => normalizeLightingVector(
  config.rimLightVector ?? DEFAULT_RIM_LIGHT_VECTOR,
);

const resolveLightingDirectionFromVector = (
  vector: LightingVector3,
): LightingDirection => {
  if (vector.z < -0.22) {
    return "back";
  }
  if (vector.y > 0.68) {
    return "top";
  }
  if (vector.y < -0.68) {
    return "bottom";
  }
  if (vector.z > 0.72 && Math.abs(vector.x) < 0.46) {
    return "front";
  }
  return vector.x < 0 ? "left" : "right";
};

export const getLightingConfigFromVector = (
  config: LightingConfig,
  vector: LightingVector3,
): LightingConfig => {
  const nextVector = normalizeLightingVector(vector);
  const sceneAngle = nextVector.z < -0.15 ? 180 : 0;
  const horizontalAngle = THREE.MathUtils.radToDeg(
    Math.atan2(nextVector.x, Math.max(0.18, Math.abs(nextVector.z))),
  );
  const pitchAngle = THREE.MathUtils.radToDeg(Math.asin(nextVector.y));

  return {
    ...config,
    presetId: "custom",
    lightDirection: resolveLightingDirectionFromVector(nextVector),
    sceneAngle,
    horizontalAngle: Math.round(
      clamp(horizontalAngle, -HORIZONTAL_RANGE, HORIZONTAL_RANGE),
    ),
    pitchAngle: Math.round(clamp(pitchAngle, -PITCH_RANGE, PITCH_RANGE)),
    lightVector: nextVector,
  };
};

export const getLightingProjection = (
  config: LightingConfig,
): LightingProjection => {
  const viewVector = getLightingVector(config);

  return getLightingProjectionFromVector(viewVector);
};

export const getRimLightingProjection = (
  config: LightingConfig,
): LightingProjection => getLightingProjectionFromVector(
  getRimLightingVector(config),
);

const getLightingProjectionFromVector = (
  viewVector: LightingVector3,
): LightingProjection => {
  return {
    x: clamp(0.5 + viewVector.x * LIGHTING_POINT_RANGE, 0, 1),
    y: clamp(0.5 - viewVector.y * LIGHTING_POINT_RANGE, 0, 1),
    depth: viewVector.z,
  };
};

export const getLightingPoint = (config: LightingConfig) => {
  const projection = getLightingProjection(config);
  return { x: projection.x, y: projection.y };
};

export const getLightingConfigFromPoint = (
  config: LightingConfig,
  point: { x: number; y: number },
): LightingConfig => {
  let viewX = (clamp(point.x, 0, 1) - 0.5) / LIGHTING_POINT_RANGE;
  let viewY = (0.5 - clamp(point.y, 0, 1)) / LIGHTING_POINT_RANGE;
  const projectedLength = Math.hypot(viewX, viewY);

  if (projectedLength > 1) {
    const scale = 1 / projectedLength;
    viewX *= scale;
    viewY *= scale;
  }

  const viewZLength = Math.sqrt(Math.max(0, 1 - viewX * viewX - viewY * viewY));
  const currentVector = getLightingVector(config);
  const desiredLocalZSign =
    currentVector.z < -0.08 || config.lightDirection === "back" ? -1 : 1;
  const frontCandidate = normalizeLightingVector({
    x: viewX,
    y: viewY,
    z: viewZLength,
  });
  const backCandidate = normalizeLightingVector({
    x: viewX,
    y: viewY,
    z: -viewZLength,
  });
  const nextVector =
    Math.sign(frontCandidate.z || 1) === desiredLocalZSign
      ? frontCandidate
      : Math.sign(backCandidate.z || -1) === desiredLocalZSign
        ? backCandidate
        : Math.abs(frontCandidate.z - desiredLocalZSign) <
            Math.abs(backCandidate.z - desiredLocalZSign)
          ? frontCandidate
          : backCandidate;

  return getLightingConfigFromVector(config, nextVector);
};

export const getRimLightingConfigFromPoint = (
  config: LightingConfig,
  point: { x: number; y: number },
): LightingConfig => {
  const currentRimVector = getRimLightingVector(config);
  const nextConfig = getLightingConfigFromPoint(
    {
      ...config,
      lightDirection: currentRimVector.z < -0.08 ? "back" : config.lightDirection,
      lightVector: currentRimVector,
    },
    point,
  );

  return {
    ...config,
    presetId: "custom",
    rimLightEnabled: true,
    rimLightVector: nextConfig.lightVector,
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

const getImageDataLuminance = (imageData: ImageData): number => {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const sampleStep = Math.max(1, Math.floor(pixelCount / 12000));
  let total = 0;
  let samples = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += sampleStep) {
    const index = pixelIndex * 4;
    if (data[index + 3] < 8) {
      continue;
    }

    total +=
      data[index] * 0.2126 +
      data[index + 1] * 0.7152 +
      data[index + 2] * 0.0722;
    samples += 1;
  }

  return samples > 0 ? total / samples : 0;
};

const getSourceImageLuminance = (
  image: HTMLImageElement,
  width: number,
  height: number,
): number | null => {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!sourceContext) {
    return null;
  }

  try {
    sourceContext.drawImage(image, 0, 0, width, height);
    return getImageDataLuminance(
      sourceContext.getImageData(0, 0, width, height),
    );
  } catch {
    return null;
  }
};

const matchCanvasBrightnessToSource = (
  image: HTMLImageElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const sourceLuminance = getSourceImageLuminance(image, width, height);
  if (!sourceLuminance) {
    return;
  }

  let imageData: ImageData;
  try {
    imageData = context.getImageData(0, 0, width, height);
  } catch {
    return;
  }

  const renderedLuminance = getImageDataLuminance(imageData);
  if (
    !renderedLuminance ||
    renderedLuminance >= sourceLuminance - BRIGHTNESS_MATCH_MIN_GAP
  ) {
    return;
  }

  const boost = Math.min(
    BRIGHTNESS_MATCH_MAX_BOOST,
    sourceLuminance / renderedLuminance,
  );
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = Math.min(255, Math.round(data[index] * boost));
    data[index + 1] = Math.min(255, Math.round(data[index + 1] * boost));
    data[index + 2] = Math.min(255, Math.round(data[index + 2] * boost));
  }

  context.putImageData(imageData, 0, 0);
};

export const renderLightingToCanvas = (
  image: HTMLImageElement,
  config: LightingConfig,
  canvas: HTMLCanvasElement,
  options: {
    maxSide?: number;
    preserveSourceAspectRatio?: boolean;
    matchSourceBrightness?: boolean;
  } = {},
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
    (hard ? 0.22 : 0.28) + intensity * (hard ? 0.5 : 0.62),
  );
  scene.add(ambientLight);

  const lightVector = getLightingVector(config);
  const backLightFactor = Math.max(0, -lightVector.z);
  const lightX = lightVector.x * planeWidth * 1.8;
  const lightY = lightVector.y * planeHeight * 1.8;
  const lightZ =
    lightVector.z >= 0
      ? 2.2 + lightVector.z * 1.35
      : -2.2 + lightVector.z * 1.2;
  const lightColor = new THREE.Color(config.color);
  const directionalLight = new THREE.DirectionalLight(
    lightColor,
    (hard ? 2.25 : 1.72) * intensity * (1 - backLightFactor * 0.28),
  );
  directionalLight.position.set(lightX, lightY, lightZ);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(
    lightColor,
    (hard ? 7.5 : 5.2) * intensity * (1 - backLightFactor * 0.38),
    6,
    hard ? 1.8 : 1.25,
  );
  pointLight.position.set(lightX, lightY, lightVector.z >= 0 ? lightZ : -1.2);
  scene.add(pointLight);

  if (backLightFactor > 0.05) {
    const bounceLight = new THREE.DirectionalLight(
      lightColor,
      (hard ? 0.35 : 0.28) * intensity * backLightFactor,
    );
    bounceLight.position.set(lightX * 0.28, lightY * 0.28, 1.35);
    scene.add(bounceLight);

    const backRimLight = new THREE.DirectionalLight(
      lightColor,
      (hard ? 0.72 : 0.48) * intensity * backLightFactor,
    );
    backRimLight.position.set(lightX, lightY, -3.4);
    scene.add(backRimLight);
  }

  if (config.rimLightEnabled) {
    const rimLightVector = getRimLightingVector(config);
    const rimLightX = rimLightVector.x * planeWidth * 1.8;
    const rimLightY = rimLightVector.y * planeHeight * 1.8;
    const rimLightZ =
      rimLightVector.z >= 0
        ? 2 + rimLightVector.z * 1.2
        : -2.4 + rimLightVector.z * 1.1;
    const rimLight = new THREE.DirectionalLight(
      "#dbe8ff",
      hard ? 0.54 * intensity : 0.34 * intensity,
    );
    rimLight.position.set(rimLightX, rimLightY, rimLightZ);
    scene.add(rimLight);
  }

  renderer.render(scene, camera);
  disposeObject3D(scene);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("无法创建灯光输出画布");
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(rendererEntry.canvas, 0, 0, width, height);
  if (intensity < 0.5) {
    context.save();
    context.globalCompositeOperation = "multiply";
    context.fillStyle = `rgba(0, 0, 0, ${(0.5 - intensity) * 0.62})`;
    context.fillRect(0, 0, width, height);
    context.restore();
  } else if (intensity > 0.5) {
    context.save();
    context.globalCompositeOperation = "screen";
    context.fillStyle = `rgba(255, 255, 255, ${(intensity - 0.5) * 0.38})`;
    context.fillRect(0, 0, width, height);
    context.restore();
  }
  if (
    options.matchSourceBrightness &&
    intensity >= BRIGHTNESS_MATCH_MIN_INTENSITY
  ) {
    matchCanvasBrightnessToSource(image, context, width, height);
  }
  if (!options.preserveSourceAspectRatio) {
    trimBackgroundMargins(canvas);
  }
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
