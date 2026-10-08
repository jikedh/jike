export const normalizeBrowserUrl = (input: string) => {
    const value = input.trim();
    if (!value || value.length > 8192) throw new Error("请输入有效网址");
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
        throw new Error("仅支持不含登录凭据的 HTTP / HTTPS 网址");
    }
    if (['localhost', 'tauri.localhost', 'asset.localhost', '::1', '127.0.0.1'].includes(url.hostname)) {
        throw new Error("不允许浏览应用内部页面");
    }
    return url.href;
};
