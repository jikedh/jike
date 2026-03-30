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
    { id: 'c-1', label: '角色参考图', command: '/character-reference', description: '把人物图集合成特写+正面，生成一张面部特写（[此处自动插入角色的性格描述]）和它的全身图（最左边是超大的人物面部特写，右边放人物全身，生成一张图片，渐变色纯色背景，丰富的光影。' },
    { id: 'c-2', label: '角色三视图', command: '/character-three-view', description: '- 把人物图集合成一个21:9的特写+三视图，生成一张面部特写（[此处自动插入角色的性格描述]）和全身三视图（最左边是超大的人物面部特写，右边放人物全身的正视图，侧视图，后视图），生成在一张图片里面，渐变色纯色背景，丰富的光影。' },
] as const
