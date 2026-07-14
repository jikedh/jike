export const DIRECTOR_DESK_MESSAGE_PROTOCOL = "jike-director-desk";
export const DIRECTOR_DESK_MESSAGE_VERSION = 1;
export const DIRECTOR_DESK_STATE_VERSION = 1;

export type DirectorDeskImage = {
    name: string;
    dataUrl: string;
    width?: number;
    height?: number;
};

export type DirectorDeskTransform = {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    scale: [number, number, number];
};

export type DirectorDeskCharacterState = {
    type: "character";
    id: string;
    name: string;
    visible: boolean;
    bodyType: "standard" | "tall" | "small" | "broad" | "slim";
    transform: DirectorDeskTransform;
    color: number;
    poseValues: Record<string, number>;
    currentPreset: string | null;
    currentClip: string | null;
};

export type DirectorDeskEntityState =
    | DirectorDeskCharacterState
    | {
        type: "prop";
        id: string;
        name: string;
        visible: boolean;
        kind: "box" | "cylinder" | "sphere" | "mannequin";
        transform: DirectorDeskTransform;
        color: number;
    }
    | {
        type: "camera";
        id: string;
        name: string;
        visible: boolean;
        transform: DirectorDeskTransform;
        fov: number;
        lookTarget: [number, number, number];
    }
    | {
        type: "crowd";
        id: string;
        name: string;
        visible: boolean;
        transform: DirectorDeskTransform;
        rows?: number;
        cols?: number;
        members: DirectorDeskCharacterState[];
    };

/** 可写入画布节点的纯 JSON 快照，不包含全景图和截图 data URL。 */
export type DirectorDeskState = {
    version: typeof DIRECTOR_DESK_STATE_VERSION;
    ratio: "auto" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
    transformMode: "translate" | "rotate" | "scale";
    cameraView: boolean;
    activeCameraId: string | null;
    directorCamera: {
        position: [number, number, number];
        quaternion: [number, number, number, number];
        target: [number, number, number];
        gridOn: boolean;
    };
    scene: {
        scale: number;
        pos: { x: number; y: number; z: number };
        rot: { x: number; y: number; z: number };
        sky: number;
        labels: boolean;
        panoRot: number;
        panoRadius: number;
        ground: { visible: boolean; opacity: number; height: number };
    };
    entities: DirectorDeskEntityState[];
};

type MessageBase = {
    protocol: typeof DIRECTOR_DESK_MESSAGE_PROTOCOL;
    version: typeof DIRECTOR_DESK_MESSAGE_VERSION;
};

export type DirectorDeskToCanvasMessage =
    | (MessageBase & { type: "ready" | "close" })
    | (MessageBase & { type: "send-images"; images: DirectorDeskImage[] })
    | (MessageBase & { type: "state-changed"; state: DirectorDeskState });

export type CanvasToDirectorDeskMessage = MessageBase & {
    type: "hydrate-state";
    state: DirectorDeskState | null;
};

export type DirectorDeskMessage =
    | DirectorDeskToCanvasMessage
    | CanvasToDirectorDeskMessage;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

const isShortString = (value: unknown, max = 200) =>
    typeof value === "string" && value.length > 0 && value.length <= max;

const isVector3 = (value: unknown): value is [number, number, number] =>
    Array.isArray(value) && value.length === 3 &&
    value.every((item) => isFiniteNumber(item, -100_000, 100_000));

const isQuaternion = (value: unknown): value is [number, number, number, number] =>
    Array.isArray(value) && value.length === 4 &&
    value.every((item) => isFiniteNumber(item, -1.1, 1.1));

const isTransform = (value: unknown): value is DirectorDeskTransform =>
    isRecord(value) && isVector3(value.position) &&
    isQuaternion(value.quaternion) && isVector3(value.scale) &&
    value.scale.every((item) => item > 0 && item <= 10_000);

const BODY_TYPES = new Set(["standard", "tall", "small", "broad", "slim"]);
const PROP_KINDS = new Set(["box", "cylinder", "sphere", "mannequin"]);
const RATIOS = new Set(["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
const TRANSFORM_MODES = new Set(["translate", "rotate", "scale"]);

const isPoseValues = (value: unknown): value is Record<string, number> => {
    if (!isRecord(value)) return false;
    const entries = Object.entries(value);
    return entries.length <= 100 && entries.every(([key, item]) =>
        key.length > 0 && key.length <= 80 && isFiniteNumber(item, -360, 360));
};

const isNullableShortString = (value: unknown) =>
    value === null || (typeof value === "string" && value.length <= 100);

const isCharacterState = (value: unknown): value is DirectorDeskCharacterState =>
    isRecord(value) && value.type === "character" &&
    isShortString(value.id, 100) && isShortString(value.name) &&
    typeof value.visible === "boolean" && typeof value.bodyType === "string" &&
    BODY_TYPES.has(value.bodyType) && isTransform(value.transform) &&
    isFiniteNumber(value.color, 0, 0xffffff) && isPoseValues(value.poseValues) &&
    isNullableShortString(value.currentPreset) && isNullableShortString(value.currentClip);

const isEntityState = (value: unknown): value is DirectorDeskEntityState => {
    if (!isRecord(value)) return false;
    if (value.type === "character") return isCharacterState(value);
    if (!isShortString(value.id, 100) || !isShortString(value.name) ||
        typeof value.visible !== "boolean" || !isTransform(value.transform)) return false;
    if (value.type === "prop") {
        return typeof value.kind === "string" && PROP_KINDS.has(value.kind) &&
            isFiniteNumber(value.color, 0, 0xffffff);
    }
    if (value.type === "camera") {
        return isFiniteNumber(value.fov, 1, 179) && isVector3(value.lookTarget);
    }
    if (value.type === "crowd") {
        return (value.rows === undefined || isFiniteNumber(value.rows, 1, 36)) &&
            (value.cols === undefined || isFiniteNumber(value.cols, 1, 36)) &&
            Array.isArray(value.members) && value.members.length > 0 &&
            value.members.length <= 36 && value.members.every(isCharacterState);
    }
    return false;
};

export const isDirectorDeskState = (value: unknown): value is DirectorDeskState => {
    if (!isRecord(value) || value.version !== DIRECTOR_DESK_STATE_VERSION) return false;
    if (typeof value.ratio !== "string" || !RATIOS.has(value.ratio) ||
        typeof value.transformMode !== "string" || !TRANSFORM_MODES.has(value.transformMode) ||
        typeof value.cameraView !== "boolean" ||
        !(value.activeCameraId === null || isShortString(value.activeCameraId, 100)) ||
        !isRecord(value.directorCamera) || !isVector3(value.directorCamera.position) ||
        !isQuaternion(value.directorCamera.quaternion) || !isVector3(value.directorCamera.target) ||
        typeof value.directorCamera.gridOn !== "boolean" || !isRecord(value.scene)) return false;
    const scene = value.scene;
    return isFiniteNumber(scene.scale, 0.01, 100) && isRecord(scene.pos) &&
        [scene.pos.x, scene.pos.y, scene.pos.z].every((item) => isFiniteNumber(item, -10_000, 10_000)) &&
        isRecord(scene.rot) && [scene.rot.x, scene.rot.y, scene.rot.z].every((item) => isFiniteNumber(item, -360_000, 360_000)) &&
        isFiniteNumber(scene.sky, 0, 0xffffff) && typeof scene.labels === "boolean" &&
        isFiniteNumber(scene.panoRot, -360_000, 360_000) && isFiniteNumber(scene.panoRadius, 1, 10_000) &&
        isRecord(scene.ground) && typeof scene.ground.visible === "boolean" &&
        isFiniteNumber(scene.ground.opacity, 0, 1) && isFiniteNumber(scene.ground.height, -10_000, 10_000) &&
        Array.isArray(value.entities) && value.entities.length <= 200 && value.entities.every(isEntityState);
};

const isValidImage = (value: unknown): value is DirectorDeskImage => {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isShortString(value.name) && typeof value.dataUrl === "string" &&
        /^data:image\/(png|jpeg|webp);base64,/i.test(value.dataUrl) &&
        value.dataUrl.length <= 20_000_000 &&
        (value.width === undefined || isFiniteNumber(value.width, 1, 32_768)) &&
        (value.height === undefined || isFiniteNumber(value.height, 1, 32_768))
    );
};

const hasValidEnvelope = (value: unknown): value is Record<string, unknown> =>
    isRecord(value) && value.protocol === DIRECTOR_DESK_MESSAGE_PROTOCOL &&
    value.version === DIRECTOR_DESK_MESSAGE_VERSION;

/** 验证 iframe 发往画布的消息。 */
export const isDirectorDeskToCanvasMessage = (
    value: unknown,
): value is DirectorDeskToCanvasMessage => {
    if (!hasValidEnvelope(value)) return false;
    if (value.type === "ready" || value.type === "close") return true;
    if (value.type === "state-changed") return isDirectorDeskState(value.state);
    return value.type === "send-images" && Array.isArray(value.images) &&
        value.images.length > 0 && value.images.length <= 12 && value.images.every(isValidImage);
};

/** 验证画布发往 iframe 的 hydration 消息。 */
export const isCanvasToDirectorDeskMessage = (
    value: unknown,
): value is CanvasToDirectorDeskMessage =>
    hasValidEnvelope(value) && value.type === "hydrate-state" &&
    (value.state === null || isDirectorDeskState(value.state));

/** 向后兼容现有父页面调用。 */
export const isDirectorDeskMessage = isDirectorDeskToCanvasMessage;
