import { marked } from "marked";

const MARKDOWN_PATTERNS = [
    /^ {0,3}#{1,6}\s+\S/m,
    /^ {0,3}>\s+\S/m,
    /^\s*[-+*]\s+\S/m,
    /^\s*\d+[.)]\s+\S/m,
    /^ {0,3}(```|~~~)[\s\S]*^ {0,3}\1/m,
    /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/m,
    /(?:^|[^*])\*\*[^*\n]+\*\*(?:[^*]|$)/m,
    /(?:^|[^_])__[^_\n]+__(?:[^_]|$)/m,
    /(?:^|\s)`[^`\n]+`(?:\s|$|[.,!?])/m,
    /^\s*\|.+\|\s*\r?\n\s*\|?\s*:?-{3,}/m,
    /\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)/m,
];

export const looksLikeMarkdown = (text: string): boolean => {
    const normalized = text.trim();
    if (!normalized || normalized.length > 200_000) return false;

    return MARKDOWN_PATTERNS.some((pattern) => pattern.test(normalized));
};

const ALLOWED_TAGS = new Set([
    "P",
    "BR",
    "H1",
    "H2",
    "H3",
    "STRONG",
    "EM",
    "S",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "CODE",
    "PRE",
    "HR",
    "A",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
]);

const sanitizeMarkdownHtml = (html: string): string => {
    const document = new DOMParser().parseFromString(html, "text/html");

    for (const element of Array.from(document.body.querySelectorAll("*"))) {
        if (!ALLOWED_TAGS.has(element.tagName)) {
            element.replaceWith(...Array.from(element.childNodes));
            continue;
        }

        for (const attribute of Array.from(element.attributes)) {
            if (element.tagName !== "A" || attribute.name !== "href") {
                element.removeAttribute(attribute.name);
            }
        }

        if (element.tagName === "A") {
            const href = element.getAttribute("href")?.trim() ?? "";
            if (!/^(https?:|mailto:)/i.test(href)) {
                element.removeAttribute("href");
            }
        }
    }

    return document.body.innerHTML;
};

export const markdownToSafeHtml = (markdown: string): string => {
    const html = marked.parse(markdown, {
        async: false,
        gfm: true,
        breaks: false,
    });

    return sanitizeMarkdownHtml(html);
};
