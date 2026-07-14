export const DIRECTOR_DESK_MESSAGE_PROTOCOL = "jike-director-desk";
export const DIRECTOR_DESK_MESSAGE_VERSION = 1;

export type DirectorDeskImage = {
    name: string;
    dataUrl: string;
    width?: number;
    height?: number;
};

export type DirectorDeskMessage =
    | {
        protocol: typeof DIRECTOR_DESK_MESSAGE_PROTOCOL;
        version: typeof DIRECTOR_DESK_MESSAGE_VERSION;
        type: "ready" | "close";
    }
    | {
        protocol: typeof DIRECTOR_DESK_MESSAGE_PROTOCOL;
        version: typeof DIRECTOR_DESK_MESSAGE_VERSION;
        type: "send-images";
        images: DirectorDeskImage[];
    };

const isValidImage = (value: unknown): value is DirectorDeskImage => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const image = value as Record<string, unknown>;
    return (
        typeof image.name === "string" &&
        image.name.length > 0 &&
        image.name.length <= 200 &&
        typeof image.dataUrl === "string" &&
        /^data:image\/(png|jpeg|webp);base64,/i.test(image.dataUrl) &&
        image.dataUrl.length <= 20_000_000 &&
        (image.width === undefined ||
            (typeof image.width === "number" &&
                Number.isFinite(image.width) &&
                image.width > 0 &&
                image.width <= 32_768)) &&
        (image.height === undefined ||
            (typeof image.height === "number" &&
                Number.isFinite(image.height) &&
                image.height > 0 &&
                image.height <= 32_768))
    );
};

/** 验证 iframe 消息，避免父页面处理未授权或结构异常的数据。 */
export const isDirectorDeskMessage = (
    value: unknown,
): value is DirectorDeskMessage => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const message = value as Record<string, unknown>;
    if (
        message.protocol !== DIRECTOR_DESK_MESSAGE_PROTOCOL ||
        message.version !== DIRECTOR_DESK_MESSAGE_VERSION
    ) {
        return false;
    }

    if (message.type === "ready" || message.type === "close") {
        return true;
    }

    return (
        message.type === "send-images" &&
        Array.isArray(message.images) &&
        message.images.length > 0 &&
        message.images.length <= 12 &&
        message.images.every(isValidImage)
    );
};
