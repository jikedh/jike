import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenText,
  Copy,
  Download,
  Folder,
  Mic,
  SquareDashedMousePointer,
  Video,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import ProjectDialog from "@/components/ProjectDialog";
import { checkVersion } from "@/api/jikeGo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FirstLoginGuideDialog, {
  type GuideItem,
} from "@/components/FirstLoginGuideDialog";
import { checkProfileCompleteness } from "@/utils/profileCompleteness";
import { getJikeingToken } from "shared/utils/utils";
import { useUserStore } from "@/stores/useUserStore";

const CURRENT_APP_VERSION = "2.2.8";

const HomePage = () => {
  const navigate = useNavigate();
  const isInternalUser = useUserStore((state) => state.isInternalUser);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<GuideItem["key"][]>([]);
  const [versionUpdate, setVersionUpdate] = useState<{
    version: string;
    downloadUrl: string;
    releaseNotes?: string;
  } | null>(null);
  // 防止 React 18 严格模式 / 路由重复挂载时重复触发校验
  const guideCheckedRef = useRef(false);
  const versionCheckedRef = useRef(false);

  // 首页完成首次绘制后检查更新，网络异常或超时均静默忽略。
  useEffect(() => {
    if (versionCheckedRef.current) return;
    versionCheckedRef.current = true;

    const frameId = window.requestAnimationFrame(() => {
      void checkVersion(CURRENT_APP_VERSION)
        .then((response) => {
          const data = response.data;
          if (
            response.code === 200 &&
            data?.hasNewVersion &&
            data.downloadUrl
          ) {
            setVersionUpdate(data);
          }
        })
        .catch((err: any) => {
          console.warn("[VersionCheck] 检查失败:", err?.message || err);
        });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleDownloadVersion = () => {
    if (!versionUpdate?.downloadUrl) return;
    void open(versionUpdate.downloadUrl);
  };

  const handleCopyDownloadUrl = async () => {
    if (!versionUpdate?.downloadUrl) return;
    await navigator.clipboard.writeText(versionUpdate.downloadUrl);
  };

  // 首次登录引导：登录成功后进入 /home，校验用户信息完整性
  // 未登录时直接跳过，避免在初次进入应用时弹出"完善账号信息"
  useEffect(() => {
    if (guideCheckedRef.current) return;
    if (!getJikeingToken()) return;
    guideCheckedRef.current = true;

    (async () => {
      try {
        const { pending } = await checkProfileCompleteness();
        if (pending.length > 0) {
          setPendingItems(pending);
          setGuideOpen(true);
        }
      } catch (err: any) {
        // 静默失败：避免阻塞首页，仅在控制台记录
        console.warn("[FirstLoginGuide] 校验失败:", err?.message || err);
      }
    })();
  }, []);

  // 单项设置完成后即时从待办列表中移除（用户从 /profile 跳转回来时再次触发）
  const handleGuideClose = () => {
    setGuideOpen(false);
  };

  // 当用户在 /profile 完成单项后回到 /home，重新校验一次弹窗
  // 未登录时直接跳过
  useEffect(() => {
    const handlePageShow = async () => {
      if (!getJikeingToken()) return;
      try {
        const { pending } = await checkProfileCompleteness();
        setPendingItems(pending);
        setGuideOpen(pending.length > 0);
      } catch {
        /* 静默 */
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
  // 功能入口卡片的数据源，保持布局与文案和参考页一致
  const features = [
    {
      id: "canvas",
      title: "无限画布",
      description:
        "可视化节点编辑器。连接 AI 代理与多模态模型，自由编排您的工业级影视工作流。",
      icon: SquareDashedMousePointer,
    },
    {
      id: "story",
      title: "故事创作",
      description:
        "由 AI Agent 驱动。从一句话灵感扩展为完整故事板、分镜脚本与影视级提示词序列。",
      icon: BookOpenText,
    },
    {
      id: "video-to-script",
      title: "视频转剧本",
      description:
        "从授权播放页解析视频链路，沉淀为后续转写、拆分分镜与剧本重构的素材入口。",
      icon: Video,
    },
    {
      id: "assets",
      title: "资产库",
      description:
        "中心化资产管理。高效存储、分类和搜索您所有生成的图像、视频素材与角色模型。",
      icon: Folder,
    },
    // {
    //   id: "voice",
    //   title: "情感配音合成",
    //   description:
    //     "深度情绪控制。为您的角色注入灵魂，生成具有好莱坞质感的多语言对白与音效。",
    //   icon: Mic,
    // },
  ] as const;

  // 创意广场展示卡片的数据源，用于呈现首页下半部分的项目集合
  const creativeProjects = [
    {
      id: 1,
      title: "《全基地背叛》正片流",
      image: "https://picsum.photos/seed/betrayal/800/500",
      tag: "Sora V1.5",
    },
    {
      id: 2,
      title: "第一集_剪辑版资产",
      image: "https://picsum.photos/seed/episode1/800/500",
      tag: "Midjourney V6",
    },
    {
      id: 3,
      title: "商业广告旁白扩写",
      image: "https://picsum.photos/seed/commercial/800/500",
      tag: "Script Agent",
    },
    {
      id: 4,
      title: "赛博朋克环境空镜",
      image: "https://picsum.photos/seed/cyberpunk/800/500",
      tag: "Kling AI",
    },
  ];

  return (
    <div className="h-full flex-1 overflow-y-auto no-scrollbar bg-[#09090b] text-white">
      {/* Hero 区：背景图、渐变遮罩和主标题，复刻参考页的第一屏视觉 */}
      <div className="relative h-112.5 w-full flex flex-col items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: 'url("https://picsum.photos/seed/hero/1920/800")',
          }}
        />
        <div className="absolute inset-0 z-0 bg-linear-to-b from-[#B43FEB]/5 via-[#09090b]/80 to-[#09090b]" />

        <div className="relative z-10 mt-8 flex flex-col items-center px-4 text-center">
          <div className="mb-6 flex items-center gap-2 text-sm font-medium tracking-wider text-[#B43FEB]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B43FEB]" />
            工业级 AI 影视引擎
          </div>
          <h1
            className="mb-10 text-5xl font-normal tracking-widest text-white drop-shadow-2xl md:text-6xl"
            style={{ fontFamily: "var(--font-legendary)" }}
          >
            即刻点亮星漫，灵感破界而生
            {/* 即刻点亮星漫，灵感破界而生(版本v2.0.5) */}
          </h1>
          <button
            onClick={() => setIsProjectDialogOpen(true)}
            className="cursor-pointer rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(180,63,235,0.3)] hover:bg-white/90 hover:shadow-[0_0_50px_rgba(180,63,235,0.5)]"
          >
            创建全新工作流
          </button>
        </div>
      </div>

      <div className="relative z-20 mx-auto max-w-7xl -mt-10 px-8 pb-24">
        {/* 功能入口：四个卡片横排展示，保留参考页的密度与层次 */}
        <div className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features
            .filter(
              (feature) =>
                isInternalUser ||
                (feature.id !== "story" &&
                  feature.id !== "video-to-script"),
            )
            .map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.id}
                  className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#121214] p-6 transition-all duration-300 hover:border-[#B43FEB] hover:bg-[#B43FEB]/5"
                  onClick={() => {
                    if (feature.id === "canvas") {
                      setIsProjectDialogOpen(true);
                    } else {
                      navigate(`/${feature.id}`);
                    }
                  }}
                >
                  <div className="absolute inset-0 bg-linear-to-b from-[#B43FEB]/0 to-[#B43FEB]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <Icon className="relative z-10 mb-6 h-6 w-6 text-white/70 transition-colors group-hover:text-[#B43FEB]" />
                  <h3 className="relative z-10 mb-3 text-lg font-semibold text-white/90 transition-colors group-hover:text-white">
                    {feature.title}
                  </h3>
                  <p className="relative z-10 text-sm leading-relaxed text-white/50 transition-colors group-hover:text-white/70">
                    {feature.description}
                  </p>
                </div>
              );
            })}
        </div>

        {/* 创意广场：项目卡片的图片、标签和标题，保持参考页一致的视觉节奏 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">创意广场</h2>
          <button className="flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white">
            查看工作空间所有项目 <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {creativeProjects.map((project) => (
            <div
              key={project.id}
              className="group flex cursor-default flex-col gap-3"
            >
              <div className="relative aspect-16/10 overflow-hidden rounded-xl border border-white/5 bg-[#121214]">
                <img
                  src={project.image}
                  alt={project.title}
                  className="h-full w-full object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
                />
                <div className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-md">
                  {project.tag}
                </div>
              </div>
              <h4 className="px-1 text-sm font-medium text-white/90 transition-colors group-hover:text-white">
                {project.title}
              </h4>
            </div>
          ))}
        </div>
      </div>

      <ProjectDialog
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        onSuccess={(projectId) => {
          setIsProjectDialogOpen(false);
          navigate(`/canvas/${projectId}`);
        }}
      />

      <FirstLoginGuideDialog
        open={guideOpen}
        pending={pendingItems}
        onClose={handleGuideClose}
      />

      <Dialog open={Boolean(versionUpdate)} onOpenChange={() => { }}>
        <DialogContent
          className="max-w-md border-white/10 bg-[#121214] text-white"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>发现新版本 v{versionUpdate?.version}</DialogTitle>
            <DialogDescription className="text-white/60">
              新版本已发布，请下载并安装后继续使用。
            </DialogDescription>
          </DialogHeader>

          {versionUpdate?.releaseNotes ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap text-white/75">
              {versionUpdate.releaseNotes}
            </div>
          ) : null}

          <button
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-white/70 hover:border-[#B43FEB]/60"
            onClick={() => void handleCopyDownloadUrl()}
          >
            <span className="min-w-0 flex-1 truncate">
              {versionUpdate?.downloadUrl}
            </span>
            <Copy className="h-4 w-4 shrink-0 text-[#B43FEB]" />
          </button>

          <DialogFooter className="border-white/10">
            <Button
              className="w-full bg-[#B43FEB] text-white hover:bg-[#B43FEB]/90"
              onClick={handleDownloadVersion}
            >
              <Download className="mr-2 h-4 w-4" />
              下载新版本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
