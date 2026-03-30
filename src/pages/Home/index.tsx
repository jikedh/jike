import { FileText, Film, FolderOpen, Clock, Sparkles, TrendingUp, Zap, Layers } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createProject } from '@/utils/projectStorage'

// 顶部横向滑动卡片数据
const carouselCards = [
    {
        id: 'left',
        type: 'cinema',
        title: 'CINEMA CENTRAL CINEMA',
        imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop',
        tags: ['AI增强', '4K输出'],
    },
    {
        id: 'center',
        type: 'templates',
        titleEn: 'WORKFLOW TEMPLATES',
        titleCn: '全新小说/剧本模板库',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
        tags: ['热门', '新功能'],
    },
    {
        id: 'right',
        type: 'circuit',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        tags: ['专业版'],
    },
]

// 底部功能面板数据
const featurePanels = [
    {
        id: 'text',
        icon: FileText,
        title: 'AI 文本与剧本创作',
        description: '基于本地文件的智能工作流。支持长篇小说管理、行内大模型扩写与剧本工业格式转换。',
        features: ['智能扩写', '格式转换', '版本管理'],
        gradient: 'from-violet-500/20 to-purple-500/20',
        accentColor: 'violet',
    },
    {
        id: 'video',
        icon: Film,
        title: 'AI 视频与视觉工坊',
        description: '剧本一键生成视觉预览。支持角色一致性控制、动态分镜生成与高分辨率成片运算。',
        features: ['角色一致性', '动态分镜', '高分辨率'],
        gradient: 'from-cyan-500/20 to-blue-500/20',
        accentColor: 'cyan',
    },
] as const

// 统计数据
const statsData = [
    { id: 'projects', icon: FolderOpen, value: '12', label: '项目总数', trend: '+3', trendUp: true },
    { id: 'files', icon: Layers, value: '248', label: '文件数量', trend: '+24', trendUp: true },
    { id: 'time', icon: Clock, value: '2.5h', label: '今日创作', trend: '+0.5h', trendUp: true },
]

// 快捷操作数据
const quickActions = [
    { id: 'new-project', icon: Sparkles, label: '新建项目', color: 'text-amber-400' },
    { id: 'templates', icon: Layers, label: '模板库', color: 'text-emerald-400' },
    { id: 'recent', icon: Clock, label: '最近项目', color: 'text-blue-400' },
]

export default function HomePage() {
    const navigate = useNavigate()

    const handleFeaturePanelClick = (panelId: string) => {
        if (panelId === 'video' || panelId === 'text') {
            const newProject = createProject()
            navigate(`/canvas/${newProject.id}`)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden relative">
            {/* 背景网格纹理 */}
            <div
                className="absolute inset-0 -z-10 opacity-30"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* 背景光效 - 顶部紫色光晕 */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-radial from-purple-500/15 via-blue-500/8 to-transparent rounded-full blur-3xl" />
                {/* 底部装饰光效 */}
                <div className="absolute bottom-[-200px] left-[10%] w-[400px] h-[400px] bg-gradient-radial from-cyan-500/10 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-[-200px] right-[10%] w-[400px] h-[400px] bg-gradient-radial from-violet-500/10 to-transparent rounded-full blur-3xl" />
            </div>

            {/* 主内容区 */}
            <main className="flex-1 flex flex-col overflow-hidden px-8 py-6 relative">
                {/* 顶部统计栏 */}
                <section className="flex-shrink-0 mb-6">
                    <div className="flex items-center justify-between">
                        {/* 左侧欢迎信息 */}
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0f]" />
                            </div>
                            <div>
                                <h2 className="text-white/90 text-sm font-medium">欢迎回来</h2>
                                <p className="text-white/40 text-xs">继续你的创作之旅</p>
                            </div>
                        </div>

                        {/* 右侧统计数据 */}
                        <div className="flex items-center gap-3">
                            {statsData.map((stat) => (
                                <StatsCard key={stat.id} data={stat} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* 顶部横向滑动展示区 */}
                <section className="flex-shrink-0">
                    <div className="flex items-center justify-center gap-6 h-[280px]">
                        {carouselCards.map((card) => (
                            <Card key={card.id} data={card} />
                        ))}
                    </div>
                </section>

                {/* 中间分隔区 - 快捷操作 */}
                <section className="flex-shrink-0 py-6">
                    <div className="flex items-center justify-center gap-8">
                        {/* 左侧装饰线 */}
                        <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        </div>

                        {/* 中间快捷操作 */}
                        <div className="flex items-center gap-2">
                            {quickActions.map((action) => (
                                <QuickActionButton key={action.id} data={action} />
                            ))}
                        </div>

                        {/* 右侧装饰线 */}
                        <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </div>
                    </div>

                    {/* 引擎选择文字 */}
                    <div className="flex justify-center mt-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <p className="text-white/50 text-xs tracking-[0.2em] font-light">
                                SELECT ENGINE // 选择启动舱
                            </p>
                        </div>
                    </div>
                </section>

                {/* 底部功能选择区 */}
          <section className="flex-1 flex items-start justify-center gap-8 pb-8 w-[80%] mx-auto">
                {featurePanels.map((panel) => (
                        <FeaturePanel key={panel.id} data={panel} onClick={() => handleFeaturePanelClick(panel.id)} />
                    ))}
                </section>
            </main>
        </div>
    )
}

// 统计卡片组件
const StatsCard = ({ data }: { data: typeof statsData[0] }) => {
    const Icon = data.icon

    return (
        <div className="relative group">
            <div className="
                flex items-center gap-3 px-4 py-2.5 rounded-xl
                bg-white/[0.03] border border-white/[0.06]
                transition-all duration-300 ease-out
                hover:bg-white/[0.05] hover:border-white/[0.1]
            ">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white/50" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-white/90 text-lg font-semibold tracking-tight">{data.value}</span>
                        <span className={`text-xs ${data.trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>{data.trend}</span>
                    </div>
                    <span className="text-white/40 text-xs">{data.label}</span>
                </div>
            </div>
        </div>
    )
}

// 快捷操作按钮组件
const QuickActionButton = ({ data }: { data: typeof quickActions[0] }) => {
    const Icon = data.icon

    return (
        <button className="
            flex items-center gap-2 px-4 py-2 rounded-lg
            bg-white/[0.03] border border-white/[0.06]
            text-white/60 text-xs font-medium
            transition-all duration-300 ease-out
            hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-white/80
        ">
            <Icon className={`w-4 h-4 ${data.color}`} />
            <span>{data.label}</span>
        </button>
    )
}

// 卡片组件
const Card = ({ data }: { data: typeof carouselCards[0] }) => {
    const isCenter = data.id === 'center'

    return (
        <div
            className={`
                relative flex-shrink-0 rounded-2xl overflow-hidden
                transition-all duration-500 ease-out cursor-pointer
                group
                ${isCenter
                    ? 'w-[340px] h-[240px] scale-100 z-10'
                    : 'w-[260px] h-[180px] scale-90 opacity-60 hover:opacity-80 hover:scale-92'
                }
            `}
        >
            {/* 图片背景 */}
            <img
                src={data.imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            {/* 遮罩层 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

            {/* 扫光效果 */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* 卡片内容 */}
            {data.type === 'templates' && (
                <div className="relative z-10 h-full flex flex-col justify-end p-6">
                    {/* 标签 */}
                    {data.tags && (
                        <div className="flex items-center gap-2 mb-3">
                            {data.tags.map((tag, index) => (
                                <span
                                    key={index}
                                    className={`
                                        px-2 py-0.5 rounded text-[10px] font-medium tracking-wider
                                        ${index === 0
                                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-400/30'
                                            : 'bg-white/10 text-white/60 border border-white/10'
                                        }
                                    `}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                    <p className="text-white/50 text-[10px] tracking-wider mb-1.5 font-medium uppercase">
                        {data.titleEn}
                    </p>
                    <h3 className="text-white text-lg font-semibold tracking-wide">
                        {data.titleCn}
                    </h3>
                </div>
            )}

            {/* 电影院卡片标题 */}
            {data.type === 'cinema' && data.title && (
                <>
                    {data.tags && (
                        <div className="absolute top-12 left-0 right-0 z-10 flex justify-center gap-2">
                            {data.tags.map((tag, index) => (
                                <span
                                    key={index}
                                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-pink-500/20 text-pink-300 border border-pink-400/30"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-black/70 backdrop-blur-md border border-pink-400/40 rounded-lg px-4 py-2 shadow-[0_0_20px_rgba(236,72,153,0.25)]">
                            <p className="text-pink-300 text-xs tracking-wider font-bold text-center">
                                {data.title}
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* 电路卡片 */}
            {data.type === 'circuit' && data.tags && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                        {data.tags[0]}
                    </span>
                </div>
            )}

            {/* 高亮边框 */}
            <div className={`
                absolute inset-0 rounded-2xl border transition-all duration-300
                ${isCenter
                    ? 'border-white/20 group-hover:border-white/30'
                    : 'border-white/10 group-hover:border-white/15'
                }
            `} />

            {/* 角落装饰 */}
            <div className="absolute top-3 left-3 w-3 h-3 border-l border-t border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-3 right-3 w-3 h-3 border-r border-t border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-3 left-3 w-3 h-3 border-l border-b border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-3 right-3 w-3 h-3 border-r border-b border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
    )
}

// 功能面板组件
const FeaturePanel = ({ data, onClick }: { data: typeof featurePanels[number]; onClick?: () => void }) => {
    const Icon = data.icon
    const colorMap = {
        violet: {
            icon: 'text-violet-400',
            glow: 'group-hover:shadow-violet-500/10',
            ring: 'group-hover:ring-violet-400/20',
            highlight: 'from-violet-400',
        },
        cyan: {
            icon: 'text-cyan-400',
            glow: 'group-hover:shadow-cyan-500/10',
            ring: 'group-hover:ring-cyan-400/20',
            highlight: 'from-cyan-400',
        },
    }
    const colors = colorMap[data.accentColor as keyof typeof colorMap]

    return (
        <div
            onClick={onClick}
            className="
                relative w-full rounded-2xl overflow-hidden
                bg-gradient-to-br from-[#12121a] to-[#0a0a0f]
                border border-white/[0.06]
                p-8 cursor-pointer
                transition-all duration-500 ease-out
                hover:border-white/[0.12] hover:bg-gradient-to-br hover:from-[#16161f] hover:to-[#0d0d12]
                group
            "
        >
            {/* 背景光效 */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${data.gradient} rounded-full blur-3xl`} />
            </div>

            {/* 顶部装饰线 */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* 图标 */}
            <div className="relative mb-6">
                <div className={`
                    w-14 h-14 rounded-2xl
                    bg-gradient-to-br from-white/[0.05] to-white/[0.02]
                    border border-white/[0.08]
                    flex items-center justify-center
                    transition-all duration-300
                    group-hover:border-white/[0.15]
                    ${colors.ring}
                    group-hover:ring-2
                `}>
                    <Icon className={`w-7 h-7 ${colors.icon} transition-transform duration-300 group-hover:scale-110`} />
                </div>
                {/* 图标角标 */}
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-0 group-hover:scale-100">
                    <Zap className="w-2.5 h-2.5 text-white" />
                </div>
            </div>

            {/* 标题 */}
            <h3 className="relative text-xl font-semibold text-white/90 mb-3 tracking-wide group-hover:text-white transition-colors duration-300">
                {data.title}
            </h3>

            {/* 描述 */}
            <p className="relative text-white/45 text-sm leading-relaxed mb-5">
                {data.description}
            </p>

            {/* 功能标签 */}
            <div className="relative flex items-center gap-2 mb-4">
                {data.features.map((feature, index) => (
                    <span
                        key={index}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.04] text-white/50 border border-white/[0.06] transition-all duration-300 group-hover:bg-white/[0.06] group-hover:text-white/60 group-hover:border-white/[0.1]"
                    >
                        {feature}
                    </span>
                ))}
            </div>

            {/* 底部操作提示 */}
            <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/30 group-hover:text-white/50 transition-colors duration-300">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">点击进入</span>
                </div>

                {/* 箭头图标 */}
                <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.06] group-hover:border-white/[0.15] transition-all duration-300">
                    <svg
                        className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-all duration-300 group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>

            {/* 渐变高亮条 */}
            <div className={`
                absolute bottom-0 left-0 right-0 h-px
                bg-gradient-to-r from-transparent ${colors.highlight}/30 to-transparent
                opacity-0 group-hover:opacity-100 transition-opacity duration-300
            `} />
        </div>
    )
}
