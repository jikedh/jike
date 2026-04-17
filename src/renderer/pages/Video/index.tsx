/**
 * Video 页面 - 本地存储 Demo
 * 用于测试 electron-store 本地数据存储
 */
import { useEffect, useState } from 'react'
import { ipcRenderService } from '../../services/ipcService'

interface UserInfo {
  username: string
  password: string
}

export default function VideoPage() {
  const [userInfo, setUserInfo] = useState<UserInfo>({ username: '', password: '' })
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  // 页面加载时获取本地数据
  useEffect(() => {
    async function loadData() {
      try {
        const data = await ipcRenderService.invoke('app:dbStore:getAll')
        if (data.userInfo) {
          setUserInfo(data.userInfo)
        }
        if (data.phone) {
          setPhone(data.phone)
        }
      } catch (e) {
        console.error('Failed to load data:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // 保存数据
  const handleSave = () => {
    setSaved(false)
    ipcRenderService.send('app:dbStore:set', { key: 'userInfo', value: userInfo })
    ipcRenderService.send('app:dbStore:set', { key: 'phone', value: phone })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center">本地存储 Demo</h1>

        <div className="bg-[#1a1a24] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">用户名</label>
            <input
              type="text"
              value={userInfo.username}
              onChange={(e) => setUserInfo({ ...userInfo, username: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-4 py-2 text-white focus:border-[#6366f1] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">密码</label>
            <input
              type="password"
              value={userInfo.password}
              onChange={(e) => setUserInfo({ ...userInfo, password: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-4 py-2 text-white focus:border-[#6366f1] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-4 py-2 text-white focus:border-[#6366f1] focus:outline-none"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-[#6366f1] hover:bg-[#5558e3] text-white font-medium py-2 rounded-lg transition-colors"
          >
            保存
          </button>

          {saved && (
            <p className="text-green-400 text-center text-sm">保存成功！</p>
          )}
        </div>

        <div className="bg-[#1a1a24] rounded-xl p-4">
          <p className="text-sm text-gray-400">当前数据预览：</p>
          <pre className="text-xs text-gray-300 mt-2 overflow-auto">
            {JSON.stringify({ userInfo, phone }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
