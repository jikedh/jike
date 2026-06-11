import { useState, useCallback } from "react";
import { updateVipScore, getBalanceInfo } from "@/api/jikeing";
import type { UserScoreBalance } from "shared/types/api/score";
import { useUserStore } from "@/stores/useUserStore";

export default function VoicePage() {
  const [delta, setDelta] = useState("");
  const [balance, setBalance] = useState<UserScoreBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await getBalanceInfo();
      setBalance(res?.data ?? null);
    } catch (e: any) {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const handleUpdate = useCallback(async () => {
    const num = Number(delta);
    if (!delta || Number.isNaN(num)) {
      setResult({ ok: false, msg: "请输入有效的积分变化量" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await updateVipScore({ userId: "", vipScoreDelta: num });
      setResult({
        ok: res?.code === 200,
        msg: res?.msg || (res?.code === 200 ? "积分更新成功" : "操作失败"),
      });
      // 同步刷新侧边栏头像上的积分显示
      useUserStore.getState().fetchBalanceInfo();
      // 刷新本页余额
      fetchBalance();
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [delta, fetchBalance]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-10">
      {/* <h1 className="text-2xl font-bold mb-8">updateVipScore 接口测试</h1> */}

      {/* 余额查询 */}
      {/* <div className="mb-6 p-4 rounded bg-white/5 border border-white/10 max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/60">当前积分余额</span>
          <button
            onClick={fetchBalance}
            disabled={balanceLoading}
            className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            {balanceLoading ? "查询中..." : "刷新余额"}
          </button>
        </div>
        {balance ? (
          <div className="space-y-1 text-sm">
            <p>
              会员积分：<span className="text-blue-400">{balance.vipScore}</span>
            </p>
            <p>
              永久积分：<span className="text-green-400">{balance.forScore}</span>
            </p>
            <p>
              今日签到：{balance.todayResigned ? "✅ 已签" : "❌ 未签"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-white/40">点击按钮查询余额</p>
        )}
      </div> */}

      {/* 积分修改 */}
      {/* <div className="p-4 rounded bg-white/5 border border-white/10 max-w-md space-y-4">
        <label className="block">
          <span className="text-sm text-white/60">vipScoreDelta（正数增加，负数减少）</span>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="例如：100 或 -50"
            className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                       focus:outline-none focus:border-blue-500 placeholder:text-white/30"
          />
        </label>

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "请求中..." : "调用 updateVipScore"}
        </button>

        {result && (
          <div
            className={`p-3 rounded text-sm ${result.ok
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
          >
            {result.msg}
          </div>
        )}
      </div> */}
    </div>
  );
}
