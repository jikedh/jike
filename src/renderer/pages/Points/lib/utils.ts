import { AVATAR_STYLES } from "./constants";

export const generateAvatarUrl = (seed: string, style: string = "adventurer") => {
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

export const getRandomStyle = (seed: string) => {
    const index =
        seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
        AVATAR_STYLES.length;
    return AVATAR_STYLES[index];
};

export const buildQrcodeImageByCodeUrl = (codeUrl: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(codeUrl)}`;
};
