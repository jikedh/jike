/**
 * 图片节点底部增强输入区 mock 数据
 * 说明：
 * - 本期保留 @mention 与 /command mock。
 * - 参考图列表改为真实上传/父节点结果驱动，不再使用 mock。
 */

export const MENTION_MOCK = [
    { id: 'm-1', label: '拆图3*3', value: 'caitu-3x3', description: '将一张图片拆分为3x3网格子图' },
] as const

export const COMMAND_MOCK = [
    { id: 'c-1', label: '增强细节', command: '/enhance', description: '提升纹理、细节与锐度' },
    { id: 'c-2', label: '电影级调色', command: '/cinematic', description: '应用电影感 LUT 色调' },
    { id: 'c-3', label: '改为极简风', command: '/minimal', description: '降低元素密度，增强留白' },
    { id: 'c-4', label: '加入景深', command: '/dof', description: '增加前后景层次与虚化' },
    { id: 'c-5', label: '统一材质', command: '/material', description: '统一为金属/陶瓷等质感' },
    { id: 'c-6', label: '提高对比度', command: '/contrast', description: '增强明暗关系与冲击力' },
    { id: 'c-7', label: '改为写实摄影', command: '/realistic', description: '趋近真实镜头表达' },
    { id: 'c-8', label: '改为插画风', command: '/illustration', description: '平涂/描边插画语言' },
    { id: 'c-9', label: '自动重写提示词', command: '/rewrite', description: '按最佳实践重写文本' },
] as const
