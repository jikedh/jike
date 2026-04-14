// 积分 API 测试 Demo 页面
// 用于测试 jikeing.ts 和 manager/score.ts 中的各个接口

import { useState } from 'react';
import {
  dailyResign,
  initScore,
  getScoreConfig,
  getBalanceInfo,
  innerAddUserScore,
} from '@/api/jikeing';
import { addScore, getUserScore, adminGetScoreConfig } from '@/api/manager/score';


// ===================== 测试按钮组件 =====================

interface TestButtonProps {
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
}

const TestButton = ({ label, onClick, loading, variant = 'default' }: TestButtonProps) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-white/20 text-white/80 hover:bg-white/10',
    ghost: 'text-white/60 hover:text-white hover:bg-white/5',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? '加载中...' : label}
    </button>
  );
};

// ===================== 日志显示组件 =====================

interface LogEntry {
  time: string;
  api: string;
  status: 'success' | 'error';
  data: any;
}

const LogPanel = ({ logs }: { logs: LogEntry[] }) => {
  return (
    <div className="bg-black/40 rounded-lg border border-white/10 p-4 h-100 overflow-y-auto">
      <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">
        控制台日志
      </h3>
      {logs.length === 0 ? (
        <p className="text-white/30 text-sm">暂无日志，点击按钮开始测试...</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`text-xs p-2 rounded ${log.status === 'success' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="opacity-60">{log.time}</span>
                <span className="font-semibold">{log.api}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${log.status === 'success' ? 'bg-green-800/50' : 'bg-red-800/50'
                  }`}>
                  {log.status === 'success' ? 'SUCCESS' : 'ERROR'}
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===================== 主组件 =====================

export default function TestPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // 添加日志
  const addLog = (api: string, status: 'success' | 'error', data: any) => {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [{ time, api, status, data }, ...prev]);
  };

  // 执行 API 调用
  const callApi = async (apiName: string, apiFunc: () => Promise<any>) => {
    setLoadingMap((prev) => ({ ...prev, [apiName]: true }));
    try {
      console.log(`[${apiName}] 请求开始`);
      const response = await apiFunc();
      console.log(`[${apiName}] 响应:`, response);
      addLog(apiName, 'success', response);
    } catch (error: any) {
      console.error(`[${apiName}] 错误:`, error);
      addLog(apiName, 'error', error?.response?.data || error.message || error);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [apiName]: false }));
    }
  };

  // ===================== 用户侧 API =====================

  const handleDailyResign = () => callApi('dailyResign (每日签到)', dailyResign);
  const handleInitScore = () => callApi('initScore (初始化积分)', initScore);
  const handleGetScoreConfig = () => callApi('getScoreConfig (获取积分配置)', getScoreConfig);
  const handleGetBalanceInfo = () => callApi('getBalanceInfo (获取积分余额)', getBalanceInfo);

  // ===================== 管理侧 API =====================

  const [uuidInput, setUuidInput] = useState('');
  const [adminScoreData, setAdminScoreData] = useState({ toUserId: '', score: 0 });

  const handleAdminAddScore = () => {
    if (!adminScoreData.toUserId) {
      alert('请输入用户 ID');
      return;
    }
    callApi('adminAddScore (管理员加积分)', () => addScore(adminScoreData));
  };

  const handleGetUserScoreByUuid = () => {
    if (!uuidInput) {
      alert('请输入 UUID');
      return;
    }
    callApi('getUserScoreByUuid (查询用户积分)', () => getUserScore({ uuid: uuidInput }));
  };

  const handleAdminGetScoreConfig = () => callApi('adminGetScoreConfig (管理员获取配置)', () => adminGetScoreConfig());

  // ===================== 内部接口 =====================

  const [innerScoreData, setInnerScoreData] = useState({ userId: '', score: 0 });

  const handleInnerAddUserScore = () => {
    if (!innerScoreData.userId) {
      alert('请输入用户 ID');
      return;
    }
    callApi('innerAddUserScore (内部加积分)', () => innerAddUserScore(innerScoreData));
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,240,255,0.08)_0%,transparent_60%)]" />
      </div>

      <main className="flex-1 overflow-y-auto scroll-smooth p-8">
        <div className="flex justify-between items-center mb-8 border-b border-white/8 pb-4">
          <h1 className="text-2xl font-semibold tracking-wider text-white/80 uppercase">
            TEST // 积分 API 测试
          </h1>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1.5 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            清除日志
          </button>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：API 测试按钮 */}
          <div className="space-y-6">
            {/* 用户侧 API */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-cyan-400 mb-4">
                用户侧 API（jike-web-api）
              </h2>
              <div className="flex flex-wrap gap-3">
                <TestButton label="每日签到" onClick={handleDailyResign} loading={loadingMap['dailyResign (每日签到)']} />
                <TestButton label="初始化积分" onClick={handleInitScore} loading={loadingMap['initScore (初始化积分)']} />
                <TestButton label="获取积分配置" onClick={handleGetScoreConfig} loading={loadingMap['getScoreConfig (获取积分配置)']} />
                <TestButton label="获取积分余额" onClick={handleGetBalanceInfo} loading={loadingMap['getBalanceInfo (获取积分余额)']} />
              </div>
            </section>

            {/* 管理侧 API */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-purple-400 mb-4">
                管理侧 API（jike-admin-api）
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">用户 UUID</label>
                    <input
                      type="text"
                      value={uuidInput}
                      onChange={(e) => setUuidInput(e.target.value)}
                      placeholder="输入 UUID"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-40 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <TestButton label="查询用户积分" onClick={handleGetUserScoreByUuid} loading={loadingMap['getUserScoreByUuid (查询用户积分)']} variant="outline" />
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">目标用户 ID</label>
                    <input
                      type="text"
                      value={adminScoreData.toUserId}
                      onChange={(e) => setAdminScoreData((prev) => ({ ...prev, toUserId: e.target.value }))}
                      placeholder="toUserId"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-40 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/50">积分数量</label>
                    <input
                      type="number"
                      value={adminScoreData.score}
                      onChange={(e) => setAdminScoreData((prev) => ({ ...prev, score: Number(e.target.value) }))}
                      placeholder="score"
                      className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-28 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <TestButton label="管理员加积分" onClick={handleAdminAddScore} loading={loadingMap['adminAddScore (管理员加积分)']} variant="outline" />
                </div>
                <TestButton label="获取管理员配置" onClick={handleAdminGetScoreConfig} loading={loadingMap['adminGetScoreConfig (管理员获取配置)']} variant="ghost" />
              </div>
            </section>

            {/* 内部接口 */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-lg font-semibold text-orange-400 mb-4">
                内部接口（jike-web-api /inner）
              </h2>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">用户 ID</label>
                  <input
                    type="text"
                    value={innerScoreData.userId}
                    onChange={(e) => setInnerScoreData((prev) => ({ ...prev, userId: e.target.value }))}
                    placeholder="userId"
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-40 focus:border-cyan-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">积分数量</label>
                  <input
                    type="number"
                    value={innerScoreData.score}
                    onChange={(e) => setInnerScoreData((prev) => ({ ...prev, score: Number(e.target.value) }))}
                    placeholder="score"
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-sm w-28 focus:border-cyan-500 outline-none"
                  />
                </div>
                <TestButton label="内部添加积分" onClick={handleInnerAddUserScore} loading={loadingMap['innerAddUserScore (内部加积分)']} variant="outline" />
              </div>
            </section>
          </div>

          {/* 右侧：日志面板 */}
          <LogPanel logs={logs} />
        </div>
      </main>
    </div>
  );
}
