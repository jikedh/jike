import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconRefresh } from '@tabler/icons-react'
import HomePage from '@/pages/Home'
import { getSceneQrcode } from '@/api/ai'
import { getJikeingToken } from '@/utils/utils'
import { useQrcodePolling } from '@/hooks/useQrcodePolling'
import { useUserStore } from '@/store/useUserStore'
import logoImg from '@/assets/logo.png'
import iconImg from '@/assets/icon.png'

// ===================== 常量配置 =====================
const MAX_RETRY_COUNT = 3
const RETRY_DELAY = 10000
const REDIRECT_DELAY = 500

// 状态类型
type LoginStatus = 'loading' | 'waiting' | 'scanned' | 'success' | 'expired' | 'error'

// 状态文本映射（替代 switch-case）
const STATUS_TEXT: Record<LoginStatus, string> = {
  loading: '正在加载二维码...',
  waiting: '请使用微信扫一扫登录',
  scanned: '请使用微信扫一扫登录',
  expired: '二维码已过期，请刷新',
  error: '加载失败，请重试',
  success: '登录成功，正在跳转...',
}

// ===================== 重复样式抽取 =====================
const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(26, 28, 51, 0.95) 0%, rgba(17, 18, 33, 0.95) 100%)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.03)',
}

const titleDecorationStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #a053db 0%, #4c62fb 100%)',
  boxShadow: '0 1px 4px rgba(76, 98, 251, 0.4)',
}

const LoginPage = () => {
  const navigate = useNavigate()

  // 状态
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [sceneId, setSceneId] = useState('')
  const [status, setStatus] = useState<LoginStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  // 轮询成功回调
  const handlePollingSuccess = useCallback(
    (token: string, userId?: string) => {
      setStatus('success')
      useUserStore.getState().fetchUserInfo()
      setTimeout(() => {
        navigate('/home')
      }, REDIRECT_DELAY)
    },
    [navigate]
  )

  const { startPolling, stopPolling } = useQrcodePolling({
    onSuccess: handlePollingSuccess,
  })

  // 获取二维码
  const fetchQrcode = useCallback(async () => {
    setStatus('loading')
    setErrorMsg('')
    setRetryCount(0)

    const attemptFetch = async (currentRetry = 0): Promise<void> => {
      try {
        const res = await getSceneQrcode()
        setQrCodeUrl(res.data.qrcode_image)
        setSceneId(res.data.scene_id)
        setStatus('waiting')
        setRetryCount(0)
      } catch (error) {
        const err = error as Error

        if (currentRetry < MAX_RETRY_COUNT) {
          setRetryCount(currentRetry + 1)
          setErrorMsg(`获取二维码失败，正在重试 (${currentRetry + 1}/${MAX_RETRY_COUNT})...`)
          setTimeout(() => attemptFetch(currentRetry + 1), RETRY_DELAY)
        } else {
          setStatus('error')
          setErrorMsg(err.message || '获取二维码失败，请重试')
        }
      }
    }

    await attemptFetch(0)
  }, [])

  // 刷新按钮
  const handleRefresh = useCallback(() => {
    stopPolling()
    fetchQrcode()
  }, [stopPolling, fetchQrcode])

  // 初始化
  useEffect(() => {
    const token = getJikeingToken()
    if (token) {
      useUserStore.getState().fetchUserInfo()
      navigate('/home')
      return
    }
    fetchQrcode()
  }, [fetchQrcode, navigate])

  // 启动轮询
  useEffect(() => {
    if (sceneId && status === 'waiting') {
      startPolling(sceneId)
    }
    return () => stopPolling()
  }, [sceneId, status, startPolling, stopPolling])

  // 判断是否为错误状态
  const isErrorState = status === 'expired' || status === 'error'

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 z-0">
        <div className="blur-sm pointer-events-none">
          <HomePage />
        </div>
      </div>

      {/* 登录卡片容器 */}
      <div className="absolute inset-0 z-10 flex justify-center items-center">
        <div
          className="w-[440px] h-[620px] relative overflow-hidden rounded-lg"
          style={{
            background: `radial-gradient(circle at 50% 0%, rgba(45, 52, 102, 0.5) 0%, transparent 60%),
                        linear-gradient(180deg, #0f1123 0%, #04050b 100%)`,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="flex flex-col items-center pt-[60px] relative z-10">
            {/* Logo */}
            <header className="mb-[40px]">
              <img
                src={logoImg}
                alt="即刻"
                className="h-[60px] object-contain"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 85, 255, 0.4))' }}
              />
            </header>

            {/* 登录卡片 */}
            <div
              className={`w-[330px] rounded-2xl flex flex-col items-center py-[35px] pb-[45px] relative z-10 ${isErrorState ? 'py-[50px]' : ''
                }`}
              style={cardStyle}
            >
              {/* 标题 */}
              <div className="text-white text-base font-medium mb-[35px] relative pb-2 tracking-wider">
                微信登录11
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] rounded" style={titleDecorationStyle} />
              </div>

              {/* 错误状态：显示刷新按钮 */}
              {isErrorState ? (
                <>
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-6 py-3 bg-white rounded-lg text-gray-800 hover:bg-gray-100"
                  >
                    <IconRefresh size={18} />
                    刷新二维码
                  </button>
                  <div className="mt-4 text-sm text-red-400 tracking-wide">
                    {status === 'expired' ? '二维码已过期' : errorMsg}
                  </div>
                </>
              ) : (
                  <>
                    {/* 二维码区域 */}
                    <div className="bg-white p-2 rounded-md relative mb-[40px]" style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)' }}>
                      {status === 'loading' ? (
                        <div className="w-[170px] h-[170px] flex flex-col items-center justify-center bg-gray-100 rounded gap-3">
                          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                          {retryCount > 0 && (
                            <span className="text-xs text-gray-500">
                              重试中 ({retryCount}/{MAX_RETRY_COUNT})
                            </span>
                          )}
                        </div>
                      ) : (
                        <img
                          src={qrCodeUrl}
                          alt="微信登录二维码"
                          className="w-[170px] h-[170px] block"
                          onError={(e) => {
                            console.error('[登录] 二维码图片加载失败')
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      {/* Logo 遮罩 */}
                      <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-lg flex justify-center items-center"
                        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                      >
                        <img src={iconImg} alt="即刻" className="w-6 h-6 object-contain" />
                      </div>
                    </div>


                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
