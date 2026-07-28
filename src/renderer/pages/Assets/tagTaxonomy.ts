/**
 * 公共 AI 资产库标签体系（静态展示数据）
 *
 * 数据来源：docs/AI仿真人漫剧资产库标签体系.md
 * 组织方式：人物 / 场景 / 道具 三大类，每类下按语义拆分为多个标签分组。
 * 标签值与资产创建时写入的标签字符串保持一致，筛选时作为后端 `tags` 参数（AND 语义）传递。
 */

export interface AssetTagGroup {
    /** 分组唯一标识 */
    key: string;
    /** 分组展示名 */
    label: string;
    /** 分组内可选标签 */
    tags: string[];
}

export interface AssetTagCategory {
    /** 分类唯一标识 */
    key: string;
    /** 分类展示名 */
    label: string;
    groups: AssetTagGroup[];
}

// ===================== 人物 =====================

const CHARACTER_GROUPS: AssetTagGroup[] = [
    { key: "gender", label: "性别", tags: ["男", "女", "中性", "未知"] },
    { key: "age", label: "年龄", tags: ["儿童", "少年", "青年", "中年", "老年"] },
    {
        key: "role",
        label: "角色定位",
        tags: ["主角", "配角", "反派", "群演", "NPC", "宠物", "怪物", "神明", "机器人"],
    },
    {
        key: "occupation",
        label: "职业身份",
        tags: [
            "学生", "老师", "医生", "护士", "警察", "军人", "特工", "侦探", "律师",
            "企业家", "总裁", "秘书", "管家", "科学家", "程序员", "黑客", "杀手",
            "刺客", "佣兵", "魔法师", "骑士", "修仙者", "皇帝", "贵族", "龙族",
            "吸血鬼", "狼人",
        ],
    },
    {
        key: "hairstyle",
        label: "发型",
        tags: ["短发", "长发", "卷发", "马尾", "双马尾", "寸头", "刘海"],
    },
    {
        key: "hairColor",
        label: "发色",
        tags: ["黑发", "白发", "银发", "金发", "红发", "蓝发", "紫发"],
    },
    {
        key: "bodyType",
        label: "体型",
        tags: ["瘦弱", "普通", "健壮", "肌肉", "丰满", "高挑", "矮小"],
    },
    {
        key: "temperament",
        label: "气质",
        tags: ["冷峻", "温柔", "阳光", "邪魅", "成熟", "可爱", "高冷", "霸气", "阴沉", "神秘"],
    },
    {
        key: "clothingEra",
        label: "服装时代",
        tags: ["现代", "古代", "未来", "末世", "中世纪", "校园", "赛博朋克", "玄幻", "仙侠"],
    },
    {
        key: "mythology",
        label: "神话体系",
        tags: ["古希腊", "古罗马", "北欧", "凯尔特", "希伯来"],
    },
    {
        key: "clothingType",
        label: "服装类型",
        tags: [
            "校服", "西装", "礼服", "休闲装", "运动服", "军装", "警服", "古装",
            "汉服", "铠甲", "斗篷", "战斗服", "机甲服",
        ],
    },
    {
        key: "pose",
        label: "动作姿态",
        tags: [
            "站立", "坐姿", "奔跑", "战斗姿态", "持武器", "施法", "挥手",
            "拥抱", "哭泣", "愤怒", "微笑", "惊讶", "受伤",
        ],
    },
    {
        key: "characterState",
        label: "人物状态",
        tags: [
            "正常", "受伤", "战斗状态", "觉醒状态", "变身状态", "黑化",
            "虚弱", "愤怒", "开心", "悲伤", "恐惧",
        ],
    },
    {
        key: "characterAssetType",
        label: "资产类型",
        tags: ["全身", "半身", "头像", "表情包", "动作库", "立绘", "三视图", "战斗形态", "特殊形态"],
    },
];

// ===================== 场景 =====================

const SCENE_GROUPS: AssetTagGroup[] = [
    {
        key: "environment",
        label: "环境",
        tags: ["室内", "室外", "城市", "乡村", "自然", "幻想世界", "宇宙", "地下", "水下", "天空", "异空间"],
    },
    {
        key: "cityPlace",
        label: "城市地点",
        tags: ["街道", "商业街", "医院", "学校", "办公室", "咖啡厅", "酒吧", "酒店", "地铁站", "机场", "商场"],
    },
    {
        key: "livingPlace",
        label: "居住地点",
        tags: ["普通住宅", "豪宅", "别墅", "公寓", "宿舍", "古宅", "城堡", "宫殿", "庄园"],
    },
    {
        key: "battlePlace",
        label: "战斗地点",
        tags: ["废墟", "战场", "基地", "实验室", "监狱", "竞技场", "军事基地"],
    },
    {
        key: "fantasyPlace",
        label: "奇幻地点",
        tags: ["森林", "魔法学院", "龙巢", "神殿", "遗迹", "地下城", "秘境"],
    },
    {
        key: "timeWeather",
        label: "时间天气",
        tags: ["白天", "黄昏", "夜晚", "凌晨", "黎明", "雨天", "雪天", "雾天", "暴风", "雷雨"],
    },
    {
        key: "atmosphere",
        label: "氛围",
        tags: ["温馨", "浪漫", "紧张", "恐怖", "诡异", "悲伤", "史诗", "神秘", "压迫", "欢乐", "危险", "末日"],
    },
    {
        key: "visualStyle",
        label: "视觉风格",
        tags: ["真人写实", "动漫", "二次元", "国漫", "欧美动画", "赛博朋克", "水墨", "暗黑", "电影感", "游戏CG"],
    },
    {
        key: "shot",
        label: "镜头",
        tags: ["远景", "大全景", "中景", "近景", "特写", "俯拍", "仰拍", "航拍", "跟拍", "第一视角"],
    },
];

// ===================== 道具 =====================

const PROP_GROUPS: AssetTagGroup[] = [
    {
        key: "weapon",
        label: "武器",
        tags: ["刀", "剑", "枪", "弓", "匕首", "法杖", "枪械", "机甲武器"],
    },
    {
        key: "techDevice",
        label: "科技设备",
        tags: ["手机", "电脑", "机器人", "芯片", "无人机", "AI设备", "通讯器", "实验设备"],
    },
    {
        key: "dailyItem",
        label: "日常用品",
        tags: ["家具", "餐具", "书籍", "文件", "钱包", "钥匙", "车辆"],
    },
    {
        key: "fantasyItem",
        label: "奇幻道具",
        tags: ["神器", "宝石", "卷轴", "符咒", "丹药", "魔法阵", "龙蛋", "圣物"],
    },
    {
        key: "propRarity",
        label: "道具属性",
        tags: ["普通", "稀有", "史诗", "传说", "神器", "禁忌", "科技", "魔法"],
    },
    {
        key: "propState",
        label: "使用状态",
        tags: ["关闭", "开启", "损坏", "破碎", "发光", "燃烧", "充能", "升级", "觉醒"],
    },
    {
        key: "propAction",
        label: "动作关联",
        tags: ["手持", "佩戴", "放置", "投掷", "攻击", "爆炸", "启动", "召唤", "掉落", "旋转"],
    },
];

// ===================== 海外 =====================

const OVERSEAS_GROUPS: AssetTagGroup[] = [
    {
        key: "region",
        label: "地区文化",
        tags: ["北美", "欧洲", "日本", "韩国", "东南亚", "中东", "拉丁美洲", "非洲"],
    },
    {
        key: "setting",
        label: "题材场景",
        tags: ["好莱坞", "纽约都市", "巴黎街头", "伦敦雨夜", "东京校园", "首尔都市", "西部小镇", "热带海岛"],
    },
    {
        key: "style",
        label: "视觉风格",
        tags: ["欧美电影", "日系动漫", "韩剧质感", "美式漫画", "迪士尼风", "赛博都市", "复古胶片", "旅行纪录片"],
    },
    {
        key: "character",
        label: "人物元素",
        tags: ["外国人", "金发", "棕发", "混血", "西装绅士", "学院制服", "街头潮流", "异域服饰"],
    },
];

// ===================== 国内 =====================

const DOMESTIC_GROUPS: AssetTagGroup[] = [
    {
        key: "region",
        label: "地域风貌",
        tags: ["北京", "上海", "广州", "深圳", "成都", "重庆", "江南", "西北", "岭南", "东北"],
    },
    {
        key: "setting",
        label: "生活场景",
        tags: ["国风街区", "城市CBD", "校园生活", "乡村田园", "夜市", "高铁站", "写字楼", "新中式住宅"],
    },
    {
        key: "culture",
        label: "文化元素",
        tags: ["国潮", "新中式", "水墨", "剪纸", "戏曲", "茶文化", "武术", "春节", "非遗"],
    },
    {
        key: "style",
        label: "内容风格",
        tags: ["国产剧", "国漫", "短剧", "生活纪实", "电商视觉", "国风广告", "都市情感", "现实主义"],
    },
];

// ===================== 古装 =====================

const COSTUME_DRAMA_GROUPS: AssetTagGroup[] = [
    {
        key: "dynasty",
        label: "时代朝代",
        tags: ["先秦", "汉代", "唐代", "宋代", "明代", "清代", "民国", "架空王朝"],
    },
    {
        key: "identity",
        label: "角色身份",
        tags: ["皇帝", "皇后", "公主", "太子", "将军", "侠客", "书生", "丫鬟", "道士", "医者"],
    },
    {
        key: "setting",
        label: "场景地点",
        tags: ["宫殿", "王府", "江湖客栈", "竹林", "古镇", "书院", "战场", "山门", "牢狱"],
    },
    {
        key: "costume",
        label: "服饰道具",
        tags: ["汉服", "唐装", "官服", "盔甲", "斗篷", "发簪", "团扇", "佩剑", "油纸伞"],
    },
    {
        key: "theme",
        label: "剧情氛围",
        tags: ["宫斗", "权谋", "武侠", "仙侠", "探案", "家国", "爱情", "复仇", "朝堂风云"],
    },
];

// ===================== 3D 古装 =====================

const THREE_D_COSTUME_DRAMA_GROUPS: AssetTagGroup[] = [
    {
        key: "rendering",
        label: "渲染风格",
        tags: ["3D国漫", "3D写实", "电影级渲染", "游戏CG", "卡通渲染", "虚幻引擎风", "高精建模", "全局光照"],
    },
    {
        key: "character",
        label: "角色造型",
        tags: ["3D侠客", "3D仙女", "3D将军", "3D帝王", "3D妖兽", "3D神将", "精致妆造", "飘逸发丝"],
    },
    {
        key: "scene",
        label: "三维场景",
        tags: ["仙侠山门", "3D宫殿", "云海", "古战场", "秘境洞府", "悬浮岛", "龙宫", "古城夜景"],
    },
    {
        key: "effects",
        label: "特效元素",
        tags: ["法术光效", "粒子特效", "御剑飞行", "灵气", "火焰", "冰霜", "雷电", "能量护盾"],
    },
    {
        key: "camera",
        label: "镜头表现",
        tags: ["角色转身", "环绕镜头", "慢动作", "史诗远景", "战斗运镜", "低机位", "景深", "动态模糊"],
    },
];

/** 公共资产库标签体系：人物 / 场景 / 道具 / 海外 / 国内 / 古装 / 3D古装 / 其他 */
export const ASSET_TAG_TAXONOMY: AssetTagCategory[] = [
    { key: "character", label: "人物", groups: CHARACTER_GROUPS },
    { key: "scene", label: "场景", groups: SCENE_GROUPS },
    { key: "prop", label: "道具", groups: PROP_GROUPS },
    { key: "overseas", label: "海外的", groups: OVERSEAS_GROUPS },
    { key: "domestic", label: "国内的", groups: DOMESTIC_GROUPS },
    { key: "costumeDrama", label: "古装的", groups: COSTUME_DRAMA_GROUPS },
    { key: "threeDCostumeDrama", label: "3D古装的", groups: THREE_D_COSTUME_DRAMA_GROUPS },
    // 「其他」分类无静态分组，标签由后端聚合接口动态提供
    { key: "other", label: "其他", groups: [] },
];
