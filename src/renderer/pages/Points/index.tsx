import { Zap, ArrowUpRight, History, Gift, CheckCircle2, ChevronRight, Wallet, CreditCard, ReceiptText, User, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getJikeingToken, getJikeingUserId } from "shared/utils/utils";

const AVATAR_STYLES = [
  "adventurer",
  "adventurer-neutral",
  "avataaars",
  "big-ears",
  "big-smile",
  "bottts",
  "croodles",
  "fun-emoji",
];

const generateAvatarUrl = (seed: string, style: string = "adventurer") => {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

const getRandomStyle = (seed: string) => {
  const index =
    seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    AVATAR_STYLES.length;
  return AVATAR_STYLES[index];
};

export function PointsView() {
  const [activeTab, setActiveTab] = useState<'usage' | 'transaction'>('usage');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const token = getJikeingToken();
    if (token) {
      // 使用与UserAvatarDropdown组件相同的逻辑生成头像
      const userId = getJikeingUserId();
      setUserId(userId);
      const userSeed = userId || "default-user";
      const avatarStyle = getRandomStyle(userSeed);
      const url = generateAvatarUrl(userSeed, avatarStyle);
      setAvatarUrl(url);
    }
  }, []);

  const packages = [
    { id: 1, points: 500, price: 9.9, originalPrice: 15, tag: '入门首选' },
    { id: 2, points: 2000, price: 29.9, originalPrice: 60, tag: '超值特惠', popular: true },
    { id: 3, points: 5000, price: 69.9, originalPrice: 150, tag: '创作达人' },
    { id: 4, points: 12000, price: 159.9, originalPrice: 360, tag: '专业工作室' },
  ];

  const usageHistory = [
    { id: 1, type: '生成图像 (Midjourney V6)', amount: '-10', date: '2024-04-13 12:30', status: 'success' },
    { id: 2, type: '视频合成 (Sora V1.5)', amount: '-50', date: '2024-04-12 15:20', status: 'success' },
    { id: 3, type: '情感配音合成', amount: '-5', date: '2024-04-11 10:15', status: 'success' },
    { id: 4, type: '剧本扩写', amount: '-2', date: '2024-04-10 09:45', status: 'success' },
  ];

  const transactionHistory = [
    { id: 1, type: '积分充值 (2000积分)', amount: '¥29.9', date: '2024-04-12 18:45', method: '微信支付' },
    { id: 2, type: '积分充值 (500积分)', amount: '¥9.9', date: '2024-03-25 14:20', method: '支付宝' },
    { id: 3, type: '每日签到奖励', amount: '+10', date: '2024-04-13 09:00', method: '系统赠送' },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#09090b] text-white font-sans scrollbar-hide">
      {/* Top Profile Header */}
      <div className="relative pt-16 pb-12 px-8 overflow-hidden border-b border-white/5 bg-gradient-to-b from-[#1a1a1c] to-[#09090b]">
        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[#B43FEB]/5 blur-[120px] -mr-40 -mt-20 rounded-full" />

        <div className="max-w-6xl mx-auto relative z-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-tr from-[#B43FEB] to-[#2b5aed] rounded-3xl blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
              <div className="relative w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/10 bg-[#161618]">
                <img
                  src={avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=default-user"}
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-[#B43FEB] p-1.5 rounded-xl shadow-lg border-2 border-[#09090b]">
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">即刻创作者</h1>
                <span className="px-2 py-0.5 rounded-md bg-[#B43FEB]/20 text-[#B43FEB] text-[10px] font-bold border border-[#B43FEB]/30">PRO MEMBER</span>
              </div>
              <p className="text-white/40 text-sm mb-4">ID: {userId || '88592031'} · 注册于 2024年3月</p>
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xs text-white/30 mb-0.5">剩余积分</span>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#B43FEB] fill-[#B43FEB]" />
                    <span className="text-2xl font-bold tracking-tighter">2,480</span>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-xs text-white/30 mb-0.5">累计消耗</span>
                  <span className="text-2xl font-bold tracking-tighter text-white/80">12.5k</span>
                </div>
              </div>
            </div>
          </div>

          {/* 暂时隐藏按钮，后续可能会用到 */}
          {/* <div className="flex gap-3">
            <button className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all">
              编辑资料
            </button>
            <button className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B43FEB] to-[#2b5aed] text-sm font-bold shadow-lg shadow-[#B43FEB]/20 hover:scale-105 transition-all">
              升级会员
            </button>
          </div> */}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-12">

          {/* Main Content: Recharge & History */}
          <div className="space-y-12">

            {/* Recharge Section */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Wallet className="w-6 h-6 text-[#B43FEB]" /> 积分充值
                  </h2>
                  <p className="text-sm text-white/40">选择最适合您的创作套餐，即刻开启无限创意</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`relative p-7 rounded-[24px] border transition-all duration-500 group cursor-pointer overflow-hidden ${
                      pkg.popular
                        ? 'bg-gradient-to-br from-[#B43FEB]/10 to-transparent border-[#B43FEB]/50 shadow-[0_20px_40px_rgba(180,63,235,0.1)]'
                        : 'bg-[#121214] border-white/5 hover:border-white/20 hover:bg-[#161618]'
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-[#B43FEB] to-[#2b5aed] text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl tracking-widest">
                        RECOMMENDED
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md mb-3 inline-block ${
                          pkg.popular ? 'bg-[#B43FEB] text-white' : 'bg-white/10 text-white/60'
                        }`}>
                          {pkg.tag}
                        </div>
                        <div className="text-3xl font-black flex items-center gap-2 tracking-tighter">
                          {pkg.points} <span className="text-xs font-medium text-white/30 tracking-normal">Points</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white tracking-tight">¥{pkg.price}</div>
                        <div className="text-xs text-white/20 line-through">¥{pkg.originalPrice}</div>
                      </div>
                    </div>
                    <button className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                      pkg.popular
                        ? 'bg-[#B43FEB] text-white shadow-xl shadow-[#B43FEB]/20 hover:scale-[1.02]'
                        : 'bg-white/5 text-white/80 group-hover:bg-white group-hover:text-black'
                    }`}>
                      立即充值
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Details Section with Tabs */}
            <section>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/5">
                  <div className="flex gap-8">
                    <button
                      onClick={() => setActiveTab('usage')}
                      className={`pb-4 text-sm font-bold transition-all relative ${
                        activeTab === 'usage' ? 'text-white' : 'text-white/30 hover:text-white/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ReceiptText className="w-4 h-4" /> 积分消耗明细
                      </div>
                      {activeTab === 'usage' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B43FEB] rounded-full" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('transaction')}
                      className={`pb-4 text-sm font-bold transition-all relative ${
                        activeTab === 'transaction' ? 'text-white' : 'text-white/30 hover:text-white/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> 充值消费明细
                      </div>
                      {activeTab === 'transaction' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B43FEB] rounded-full" />
                      )}
                    </button>
                  </div>
                  <button className="pb-4 text-xs text-white/30 hover:text-white transition-colors">导出记录</button>
                </div>

                <div className="bg-[#121214] border border-white/5 rounded-[24px] overflow-hidden">
                  {activeTab === 'usage' ? (
                    <div className="divide-y divide-white/5">
                      {usageHistory.map((item) => (
                        <div key={item.id} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
                              <Zap className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white/90">{item.type}</div>
                              <div className="text-[10px] text-white/30 font-mono tracking-wider uppercase">{item.date}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-white/90">{item.amount}</div>
                            <div className="text-[10px] text-green-500/80 font-bold uppercase">Completed</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {transactionHistory.map((item) => (
                        <div key={item.id} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              item.amount.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {item.amount.startsWith('+') ? <Gift className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white/90">{item.type}</div>
                              <div className="text-[10px] text-white/30 font-mono tracking-wider uppercase">{item.date} · {item.method}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-black ${item.amount.startsWith('+') ? 'text-green-500' : 'text-white'}`}>
                              {item.amount}
                            </div>
                            <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Success</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-4 bg-white/[0.02] text-center">
                    <button className="text-[10px] font-bold text-white/20 hover:text-white/40 transition-colors tracking-widest uppercase">
                      查看更多历史记录
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}

export default PointsView;
