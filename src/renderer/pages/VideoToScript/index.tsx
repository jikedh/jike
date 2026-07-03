import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  FileJson,
  Link2,
  Loader2,
  PlayCircle,
  RotateCcw,
  Video,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProbeStatus = "success" | "error";

type EpisodeM3u8Result = {
  episode: number;
  pageUrl: string;
  m3u8Url: string;
  title: string;
  nextPageUrl: string;
  status: ProbeStatus;
  message?: string;
};

type PlayerPayload = {
  url?: string;
  url_next?: string;
  link?: string;
  link_next?: string;
  id?: string;
  sid?: number;
  nid?: number;
  vod_data?: {
    vod_name?: string;
  };
};

type CommandResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type M3u8ToMp4Result = {
  path: string;
  format: string;
  method: string;
  skippedSegments?: number;
  skippedUrls?: string[];
};

const DEFAULT_START_URL =
  "https://www.hongguostudio.com/vodplay/29962-1-1.html";
const DEFAULT_MAX_EPISODES = 80;
const HARD_MAX_EPISODES = 200;

const extractEpisodeFromUrl = (pageUrl: string) => {
  const match = pageUrl.match(/-(\d+)\.html(?:[?#].*)?$/);
  return match ? Number(match[1]) : 0;
};

const normalizeMaxEpisodes = (value: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_MAX_EPISODES;
  return Math.max(1, Math.min(HARD_MAX_EPISODES, Math.floor(numericValue)));
};

const toAbsoluteUrl = (value: string | undefined, baseUrl: string) => {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
};

const extractPlayerPayload = (html: string): PlayerPayload => {
  const match = html.match(
    /var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*(?:;|<\/script>)/,
  );

  if (!match?.[1]) {
    throw new Error("页面中未找到 player_aaaa 播放数据");
  }

  try {
    return JSON.parse(match[1]) as PlayerPayload;
  } catch {
    throw new Error("player_aaaa 播放数据格式无法解析");
  }
};

const requestPageHtml = async (pageUrl: string, signal: AbortSignal) => {
  const response = await tauriFetch(pageUrl, {
    method: "GET",
    signal,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`页面请求失败：HTTP ${response.status}`);
  }

  return response.text();
};

const buildPlainText = (results: EpisodeM3u8Result[]) =>
  results
    .filter((item) => item.status === "success" && item.m3u8Url)
    .map((item) => `第${item.episode}集 ${item.m3u8Url}`)
    .join("\n");

const sanitizeFileName = (value: string) => {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return normalized || "video";
};

const getEpisodeFileName = (item: EpisodeM3u8Result) => {
  const title = item.title ? `${item.title}_` : "";
  return sanitizeFileName(
    `${title}第${String(item.episode).padStart(2, "0")}集.mp4`,
  );
};

const joinPath = (dir: string, filename: string) => {
  const separator = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${separator}${filename}`;
};

const convertM3u8ToMp4 = async (m3u8Url: string, outputPath: string) => {
  const response = await invoke<CommandResponse<M3u8ToMp4Result>>(
    "video_download_m3u8_to_mp4",
    {
      request: {
        m3u8Url,
        outputPath,
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "m3u8 转 MP4 失败");
  }

  return response.data;
};

export default function VideoToScriptPage() {
  const [startUrl, setStartUrl] = useState(DEFAULT_START_URL);
  const [maxEpisodes, setMaxEpisodes] = useState(String(DEFAULT_MAX_EPISODES));
  const [results, setResults] = useState<EpisodeM3u8Result[]>([]);
  const [running, setRunning] = useState(false);
  const [currentPageUrl, setCurrentPageUrl] = useState("");
  const [downloadingMap, setDownloadingMap] = useState<Record<number, boolean>>(
    {},
  );
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const successCount = useMemo(
    () => results.filter((item) => item.status === "success").length,
    [results],
  );

  const runProbe = async () => {
    let nextPageUrl = startUrl.trim();
    if (!nextPageUrl) {
      toast.error("请输入第一集播放页链接");
      return;
    }

    try {
      nextPageUrl = new URL(nextPageUrl).toString();
    } catch {
      toast.error("播放页链接格式不正确");
      return;
    }

    const limit = normalizeMaxEpisodes(maxEpisodes);
    const visited = new Set<string>();
    const abortController = new AbortController();
    abortRef.current = abortController;
    setRunning(true);
    setResults([]);
    setCurrentPageUrl(nextPageUrl);

    try {
      for (let index = 0; index < limit; index += 1) {
        if (abortController.signal.aborted) break;
        if (!nextPageUrl || visited.has(nextPageUrl)) break;

        visited.add(nextPageUrl);
        setCurrentPageUrl(nextPageUrl);

        try {
          const html = await requestPageHtml(
            nextPageUrl,
            abortController.signal,
          );
          const payload = extractPlayerPayload(html);
          const m3u8Url = String(payload.url || "").replace(/\\\//g, "/");
          const absoluteNextPageUrl = toAbsoluteUrl(
            payload.link_next,
            nextPageUrl,
          );
          const episode =
            Number(payload.nid) ||
            extractEpisodeFromUrl(nextPageUrl) ||
            index + 1;

          if (!m3u8Url || !m3u8Url.includes(".m3u8")) {
            throw new Error("当前集未解析到明文 .m3u8 地址");
          }

          const item: EpisodeM3u8Result = {
            episode,
            pageUrl: nextPageUrl,
            m3u8Url,
            title: payload.vod_data?.vod_name || "",
            nextPageUrl: absoluteNextPageUrl,
            status: "success",
          };

          setResults((current) => [...current, item]);

          if (!absoluteNextPageUrl || absoluteNextPageUrl === nextPageUrl) {
            break;
          }

          nextPageUrl = absoluteNextPageUrl;
        } catch (error) {
          if (abortController.signal.aborted) break;

          setResults((current) => [
            ...current,
            {
              episode: extractEpisodeFromUrl(nextPageUrl) || index + 1,
              pageUrl: nextPageUrl,
              m3u8Url: "",
              title: "",
              nextPageUrl: "",
              status: "error",
              message: error instanceof Error ? error.message : "解析失败",
            },
          ]);
          break;
        }
      }
    } finally {
      setRunning(false);
      setCurrentPageUrl("");
      abortRef.current = null;
    }
  };

  const stopProbe = () => {
    abortRef.current?.abort();
    setRunning(false);
    setCurrentPageUrl("");
  };

  const copyText = async (format: "text" | "json") => {
    const content =
      format === "json"
        ? JSON.stringify(results, null, 2)
        : buildPlainText(results);
    if (!content) {
      toast.error("暂无可复制的解析结果");
      return;
    }

    await navigator.clipboard.writeText(content);
    toast.success(format === "json" ? "JSON 已复制" : "链接列表已复制");
  };

  const downloadOne = async (item: EpisodeM3u8Result) => {
    if (!item.m3u8Url) return;

    const outputPath = await save({
      title: "保存 MP4",
      defaultPath: getEpisodeFileName(item),
      filters: [{ name: "MP4 视频", extensions: ["mp4"] }],
    });
    if (!outputPath) return;

    setDownloadingMap((current) => ({ ...current, [item.episode]: true }));
    try {
      const result = await convertM3u8ToMp4(item.m3u8Url, outputPath);
      toast.success(
        result.skippedSegments
          ? `第${item.episode}集已保存，跳过 ${result.skippedSegments} 个坏分片：${result.path}`
          : `第${item.episode}集已保存：${result.path}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setDownloadingMap((current) => {
        const next = { ...current };
        delete next[item.episode];
        return next;
      });
    }
  };

  const downloadAll = async () => {
    const downloadableItems = results.filter(
      (item) => item.status === "success" && item.m3u8Url,
    );
    if (downloadableItems.length === 0) {
      toast.error("暂无可下载的 m3u8 结果");
      return;
    }

    const selected = await open({
      title: "选择保存文件夹",
      directory: true,
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;

    setBulkDownloading(true);
    let skippedTotal = 0;
    try {
      for (const item of downloadableItems) {
        setDownloadingMap((current) => ({ ...current, [item.episode]: true }));
        try {
          const result = await convertM3u8ToMp4(
            item.m3u8Url,
            joinPath(selected, getEpisodeFileName(item)),
          );
          skippedTotal += result.skippedSegments || 0;
        } finally {
          setDownloadingMap((current) => {
            const next = { ...current };
            delete next[item.episode];
            return next;
          });
        }
      }
      toast.success(
        skippedTotal > 0
          ? `已保存 ${downloadableItems.length} 个 MP4，跳过 ${skippedTotal} 个坏分片`
          : `已保存 ${downloadableItems.length} 个 MP4`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量保存失败");
    } finally {
      setBulkDownloading(false);
    }
  };

  return (
    <div className="h-full flex-1 overflow-y-auto bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-8 py-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#B43FEB]">
              <Video size={18} />
              视频转剧本
            </div>
            <h1 className="text-3xl font-semibold tracking-wide text-white">
              播放页视频链接解析
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
              输入第一集播放页，按页面里的下一集链接逐集读取 HTML，并提取明文
              player_aaaa.url。当前版本只做技术验证，不请求视频分片。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center">
            <div>
              <div className="text-lg font-semibold text-white">
                {results.length}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">已处理</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-emerald-300">
                {successCount}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">成功</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                {normalizeMaxEpisodes(maxEpisodes)}
              </div>
              <div className="mt-0.5 text-[11px] text-white/35">上限</div>
            </div>
          </div>
        </header>

        <section className="mb-5 rounded-xl border border-white/8 bg-[#121214] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_140px_auto]">
            <label className="min-w-0">
              <span className="mb-2 block text-xs font-medium text-white/50">
                第一集播放页
              </span>
              <Input
                value={startUrl}
                onChange={(event) => setStartUrl(event.target.value)}
                disabled={running}
                placeholder="https://www.hongguostudio.com/vodplay/29962-1-1.html"
                className="h-10 border-white/10 bg-black/35 text-white placeholder:text-white/25"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium text-white/50">
                最大集数
              </span>
              <Input
                type="number"
                min={1}
                max={HARD_MAX_EPISODES}
                value={maxEpisodes}
                onChange={(event) => setMaxEpisodes(event.target.value)}
                disabled={running}
                className="h-10 border-white/10 bg-black/35 text-white"
              />
            </label>

            <div className="flex items-end gap-2">
              {running ? (
                <Button
                  variant="default"
                  className="h-10 border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                  onClick={stopProbe}
                >
                  停止
                </Button>
              ) : (
                <Button variant="blue" className="h-10" onClick={runProbe}>
                  <PlayCircle size={16} />
                  开始解析
                </Button>
              )}
              <Button
                variant="default"
                className="h-10"
                disabled={running || results.length === 0}
                onClick={() => setResults([])}
                title="清空结果"
              >
                <RotateCcw size={16} />
              </Button>
            </div>
          </div>

          {running && currentPageUrl ? (
            <div className="mt-4 flex min-w-0 items-center gap-2 rounded-lg border border-[#B43FEB]/20 bg-[#B43FEB]/8 px-3 py-2 text-xs text-[#E9C7FF]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              <span className="shrink-0">正在读取</span>
              <span className="truncate text-white/55">{currentPageUrl}</span>
            </div>
          ) : null}
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/8 bg-[#121214]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
            <div>
              <h2 className="text-base font-medium text-white/90">解析结果</h2>
              <p className="mt-1 text-xs text-white/35">
                仅展示页面明文暴露的 m3u8 地址，后续可接入转写与剧本拆分流程。
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={results.length === 0}
                onClick={() => copyText("text")}
              >
                <Clipboard size={14} />
                复制链接
              </Button>
              <Button
                size="sm"
                disabled={results.length === 0}
                onClick={() => copyText("json")}
              >
                <FileJson size={14} />
                复制 JSON
              </Button>
              <Button
                size="sm"
                variant="blue"
                loading={bulkDownloading}
                disabled={results.length === 0 || bulkDownloading}
                onClick={downloadAll}
              >
                <Download size={14} />
                全部保存 MP4
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-white/35">
              <Link2 size={28} />
              <div className="text-sm">还没有解析结果</div>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[960px] table-fixed border-collapse">
                <thead className="sticky top-0 bg-[#18181a] text-left text-xs text-white/45">
                  <tr>
                    <th className="w-20 px-4 py-3 font-medium">集数</th>
                    <th className="w-32 px-4 py-3 font-medium">状态</th>
                    <th className="w-32 px-4 py-3 font-medium">操作</th>
                    <th className="px-4 py-3 font-medium">m3u8</th>
                    <th className="px-4 py-3 font-medium">播放页</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {results.map((item) => (
                    <tr key={`${item.episode}-${item.pageUrl}`}>
                      <td className="px-4 py-3 text-white/75">
                        第{item.episode}集
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                            item.status === "success"
                              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                              : "border-red-400/20 bg-red-500/10 text-red-200",
                          )}
                        >
                          {item.status === "success" ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <AlertCircle size={13} />
                          )}
                          {item.status === "success"
                            ? "成功"
                            : item.message || "失败"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          loading={Boolean(downloadingMap[item.episode])}
                          disabled={
                            item.status !== "success" ||
                            !item.m3u8Url ||
                            Boolean(downloadingMap[item.episode]) ||
                            bulkDownloading
                          }
                          onClick={() => downloadOne(item)}
                        >
                          <Download size={13} />
                          保存 MP4
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate font-mono text-xs text-[#DDB7FF]">
                          {item.m3u8Url || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate text-xs text-white/45">
                          {item.pageUrl}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
