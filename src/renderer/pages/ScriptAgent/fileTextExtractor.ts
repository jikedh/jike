import JSZip from "jszip";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const SUPPORTED_FILE_EXTENSIONS = new Set([
    "docx",
    "xlsx",
    "xls",
    "pptx",
    "md",
    "markdown",
    "txt",
    "csv",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 60_000;

const getExtension = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf(".");
    return dotIndex === -1 ? "" : fileName.slice(dotIndex + 1).toLowerCase();
};

const limitText = (content: string) =>
    content.length > MAX_TEXT_LENGTH
        ? `${content.slice(0, MAX_TEXT_LENGTH)}\n\n[内容过长，已截取前 ${MAX_TEXT_LENGTH.toLocaleString()} 个字符]`
        : content;

const getXmlText = (xml: string) => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    return document.documentElement.textContent?.trim() ?? "";
};

const extractPowerPointText = async (file: File) => {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slidePaths = Object.keys(zip.files)
        .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
        .sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true }),
        );

    const slides = await Promise.all(
        slidePaths.map(async (path, index) => {
            const xml = await zip.file(path)?.async("text");
            const text = xml ? getXmlText(xml) : "";
            return text ? `第 ${index + 1} 页\n${text}` : "";
        }),
    );

    return slides.filter(Boolean).join("\n\n");
};

const extractExcelText = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const content = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
        return content ? `工作表：${sheetName}\n${content}` : "";
    })
        .filter(Boolean)
        .join("\n\n");
};

export const validateScriptAgentFile = (file: File) => {
    const extension = getExtension(file.name);
    if (!SUPPORTED_FILE_EXTENSIONS.has(extension)) {
        throw new Error("仅支持 Word、Excel、PowerPoint、Markdown、文本和 CSV 文件");
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new Error("单个文件不能超过 10MB");
    }
};

export const extractScriptAgentFileText = async (file: File) => {
    validateScriptAgentFile(file);
    const extension = getExtension(file.name);
    const extractionMap: Record<string, () => Promise<string>> = {
        docx: async () => {
            const result = await mammoth.extractRawText({
                arrayBuffer: await file.arrayBuffer(),
            });
            return result.value;
        },
        xlsx: () => extractExcelText(file),
        xls: () => extractExcelText(file),
        pptx: () => extractPowerPointText(file),
        md: () => file.text(),
        markdown: () => file.text(),
        txt: () => file.text(),
        csv: () => file.text(),
    };

    const extract = extractionMap[extension];
    if (!extract) {
        throw new Error("当前文件格式暂不支持解析");
    }

    const content = limitText((await extract()).trim());
    if (!content) {
        throw new Error("未从文件中提取到可用文本");
    }

    return content;
};
