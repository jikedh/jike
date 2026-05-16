import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createRhartImageG2OfficialTextToImage,
    createRhartImageG2TextToImage,
    createRhartImageNProOfficialTextToImage,
    createRhartImageNProTextToImage,
    queryRunningHubV2Task,
} from "@/api/jikeGo";
import { Button } from "@/components/ui/button";
const RHART_IMAGE_TASKS = [
    {
        key: "g2",
        title: "全能图片G-2.0-文生图-低价渠道版",
        defaultPrompt:
            '生成一张充满未来感的咖啡馆宣传海报。画面中央是一个发光的霓虹灯招牌，上面清晰且准确地拼写着英文单词 "CyberBrew"。背景是带有极简主义和现代高级感的城市街道，光影具有强烈的 Stripe UI 风格。',
        defaultAspectRatio: "16:9",
        defaultResolution: "1k",
        hasQuality: false,
        submit: createRhartImageG2TextToImage,
    },
    {
        key: "g2-official",
        title: "全能图片G-2-文生图-官方稳定版",
        defaultPrompt:
            "一张高端商业摄影海报。画面正中央是一个采用极简设计的白色磨砂质感智能音箱。音箱放置在浅灰色的水磨石台面上。背景是纯净的低饱和度米色墙面，一束柔和的自然光从斜上方 45 度角打下。",
        defaultAspectRatio: "16:9",
        defaultResolution: "2k",
        defaultQuality: "medium",
        hasQuality: true,
        submit: createRhartImageG2OfficialTextToImage,
    },
    {
        key: "n-pro",
        title: "全能图片PRO-文生图-低价渠道版",
        defaultPrompt:
            "一群猴子在茂密、阳光斑驳的热带森林中激烈争抢一根非常小的香蕉。猴子们跳跃、伸手、抓挠，表情夸张，画面充满动感，色彩鲜艳生动。",
        defaultAspectRatio: "9:16",
        defaultResolution: "1k",
        hasQuality: false,
        submit: createRhartImageNProTextToImage,
    },
    {
        key: "n-pro-official",
        title: "全能图片PRO-文生图-官方稳定版",
        defaultPrompt:
            "在一片广阔无垠的大海边，一只快乐的猴子坐在沙滩上，享受着温暖的阳光。天空湛蓝，阳光明媚，海浪轻拍沙滩，整体风格为手绘插画。",
        defaultAspectRatio: "3:4",
        defaultResolution: "1k",
        hasQuality: false,
        submit: createRhartImageNProOfficialTextToImage,
    },
];
const RHART_IMAGE_ASPECT_RATIOS = [
    "1:1",
    "3:2",
    "2:3",
    "5:4",
    "4:5",
    "16:9",
    "9:16",
    "21:9",
    "3:4",
    "4:3",
    "9:21",
];
const RHART_IMAGE_RESOLUTIONS = ["1k", "2k", "4k"];
const RHART_IMAGE_QUALITIES = ["low", "medium", "high"];
const RunningHubTextToImageDemo = () => {
    const navigate = useNavigate();
    const [forms, setForms] = useState(() =>
        RHART_IMAGE_TASKS.reduce(
            (data, task) => ({
                ...data,
                [task.key]: {
                    prompt: task.defaultPrompt,
                    aspectRatio: task.defaultAspectRatio,
                    resolution: task.defaultResolution,
                    quality: task.defaultQuality || "medium",
                },
            }),
            {} as Record<
                string,
                {
                    prompt: string;
                    aspectRatio: string;
                    resolution: string;
                    quality: string;
                }
            >,
        ),
    );
    const [states, setStates] = useState(
        {} as Record<
            string,
            {
                loading?: boolean;
                taskId?: string;
                status?: string;
                error?: string;
                results?: any[];
            }
        >,
    );
    const updateForm = (
        key: string,
        field: "prompt" | "aspectRatio" | "resolution" | "quality",
        value: string,
    ) => {
        setForms((current) => ({
            ...current,
            [key]: { ...current[key], [field]: value },
        }));
    };
    const updateState = (key: string, value: Record<string, any>) => {
        setStates((current) => ({
            ...current,
            [key]: { ...current[key], ...value },
        }));
    };
    const pollV2Task = async (key: string, id: string) => {
        const maxAttempts = 60;
        let attempts = 0;
        const poll = async () => {
            attempts++;
            try {
                const response: any = await queryRunningHubV2Task({ taskId: id });
                const data = response?.data ?? response;
                const status = data?.status || '';
                updateState(key, { status, results: data?.results || [] });
                if (status === "SUCCESS" || status === "FAILED") {
                    updateState(key, {
                        loading: false,
                        error: status === "FAILED" ? data?.errorMessage || "任务生成失败" : "",
                    });
                    return;
                }
                if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                } else {
                    updateState(key, { loading: false, error: "达到最大轮询次数" });
                }
            } catch (err: any) {
                if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                    return;
                }
                updateState(key, {
                    loading: false,
                    error: "查询失败: " + (err?.message || JSON.stringify(err)),
                });
            }
        };
        await poll();
    };
    const handleSubmit = async (task: (typeof RHART_IMAGE_TASKS)[number]) => {
        const form = forms[task.key];
        if (!form.prompt.trim()) {
            updateState(task.key, { error: "请输入 prompt" });
            return;
        }
        updateState(task.key, {
            loading: true,
            taskId: "",
            status: "",
            error: "",
            results: [],
        });
        try {
            const response: any = await task.submit({
                prompt: form.prompt.trim(),
                aspectRatio: form.aspectRatio,
                resolution: form.resolution,
                ...(task.hasQuality ? { quality: form.quality } : {}),
            });
            const data = response?.data ?? response;
            if (!data?.taskId) {
                updateState(task.key, {
                    loading: false,
                    error: "未获取到 taskId: " + JSON.stringify(response),
                });
                return;
            }
            updateState(task.key, {
                taskId: data.taskId,
                status: data.status || "QUEUED",
                results: data.results || [],
            });
            await pollV2Task(task.key, data.taskId);
        } catch (err: any) {
            updateState(task.key, {
                loading: false,
                error: "提交失败: " + (err?.message || JSON.stringify(err)),
            });
        }
    };
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
            <div className="max-w-5xl space-y-4">
                <h1 className="text-2xl font-bold mb-6">RunningHub 文生图 V2 Demo</h1>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {RHART_IMAGE_TASKS.map((task) => {
                        const form = forms[task.key];
                        const state = states[task.key] || {};
                        const imageResults = (state.results || []).filter((item) => item?.url);
                        return (
                            <div
                                key={task.key}
                                className="space-y-3 p-4 bg-white/5 border-white/10 rounded-lg"
                            >
                                <h3 className="font-semibold text-white">{task.title}</h3>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Prompt</label>
                                    <textarea
                                        value={form.prompt}
                                        onChange={(e) => updateForm(task.key, "prompt", e.target.value)}
                                        className="w-full min-h-28 rounded-md bg-white/5 border-white/10 text-white px-3 py-2 text-sm outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">比例</label>
                                        <select
                                            value={form.aspectRatio}
                                            onChange={(e) => updateForm(task.key, "aspectRatio", e.target.value)}
                                            className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm"
                                        >
                                            {RHART_IMAGE_ASPECT_RATIOS.map((ratio) => (
                                                <option key={ratio} value={ratio}>
                                                    {ratio}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">分辨率</label>
                                        <select
                                            value={form.resolution}
                                            onChange={(e) => updateForm(task.key, "resolution", e.target.value)}
                                            className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm"
                                        >
                                            {RHART_IMAGE_RESOLUTIONS.map((resolution) => (
                                                <option key={resolution} value={resolution}>
                                                    {resolution}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {task.hasQuality && (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">质量</label>
                                            <select
                                                value={form.quality}
                                                onChange={(e) => updateForm(task.key, "quality", e.target.value)}
                                                className="w-full rounded-md bg-[#151d] border-white/10 text-white px-2 py-2 text-sm"
                                            >
                                                {RHART_IMAGE_QUALITIES.map((quality) => (
                                                    <option key={quality} value={quality}>
                                                        {quality}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    onClick={() => handleSubmit(task)}
                                    disabled={state.loading}
                                    variant="blue"
                                >
                                    {state.loading ? "生成中..." : "提交文生图任务"}
                                </Button>
                                {state.taskId && (
                                    <p className="text-sm text-gray-400 break-all">任务ID: {state.taskId}</p>
                                )}
                                {state.status && (
                                    <p className="text-sm text-gray-400">
                                        状态: <span className={state.status === "SUCCESS" ? "text-green-400" : state.status === "FAILED" ? "text-red-400" : "text-yellow-400"}>{state.status}</span>
                                    </p>
                                )}
                                {state.error && (
                                    <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
                                        {state.error}
                                    </p>
                                )}
                                {imageResults.length > 0 && (
                                    <div className="grid grid-cols-1 gap-3">
                                        {imageResults.map((item, index) => (
                                            <div key={`${item.url}-${index}`} className="bg-black/20 rounded-lg p-3">
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 text-xs break-all block mb-2"
                                                >
                                                    {item.url}
                                                </a>
                                                <img
                                                    src={item.url}
                                                    alt="RunningHub 生成结果"
                                                    className="w-full rounded-lg"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="pt-6 border-t border-white/10">
                    <Button onClick={() => navigate("/video")} variant="blue">
                        返回短片合成
                    </Button>
                </div>
            </div>
        </div>
    );
};
export default RunningHubTextToImageDemo;
