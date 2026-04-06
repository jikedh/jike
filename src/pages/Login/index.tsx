import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconRefresh } from '@tabler/icons-react'
import HomePage from '@/pages/Home'
import { getSceneQrcode, querySceneStatus, setJikeingToken, setJikeingUserId, getJikeingToken, type LoginResponse } from '@/api/jikeing'

const LoginPage = () => {
    const navigate = useNavigate()
    const [qrCodeUrl, setQrCodeUrl] = useState('')
    const [sceneId, setSceneId] = useState('')
    const [status, setStatus] = useState<'loading' | 'waiting' | 'scanned' | 'success' | 'expired' | 'error'>('loading')
    const [errorMsg, setErrorMsg] = useState('')
    const pollingRef = useRef<NodeJS.Timeout | null>(null)

    const fetchQrcode = useCallback(async () => {
        setStatus('loading')
        setErrorMsg('')
        try {
            const res = await getSceneQrcode()
            setQrCodeUrl(res.qrcode_image)
            setSceneId(res.scene_id)
            setStatus('waiting')
        } catch (error) {
            console.error('获取二维码失败:', error)
            setStatus('error')
            setErrorMsg('获取二维码失败，请重试')
        }
    }, [])

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
        }
    }, [])

    const startPolling = useCallback((sid: string) => {
        stopPolling()
        pollingRef.current = setInterval(async () => {
            try {
                const res: LoginResponse = await querySceneStatus(sid)
                console.log('[轮询结果]', res)
                if (res.status === -1) {
                    setStatus('expired')
                    stopPolling()
                } else if (res.status === 0) {
                    setStatus('waiting')
                } else if (res.status === 1 && res.token) {
                    setStatus('success')
                    stopPolling()
                    setJikeingToken(res.token)
                    setJikeingUserId(res.id)
                    setTimeout(() => {
                        navigate('/home')
                    }, 500)
                }
            } catch (error) {
                console.error('查询状态失败:', error)
            }
        }, 2000)
    }, [stopPolling, navigate])

    useEffect(() => {
        const token = getJikeingToken()
        if (token) {
            navigate('/home')
            return
        }
        fetchQrcode()
        return () => stopPolling()
    }, [fetchQrcode, stopPolling, navigate])

    useEffect(() => {
        if (sceneId && status === 'waiting') {
            startPolling(sceneId)
        }
    }, [sceneId, status, startPolling])

    const handleRefresh = () => {
        stopPolling()
        fetchQrcode()
    }

    const getStatusText = () => {
        switch (status) {
            case 'loading':
                return '正在加载二维码...'
            case 'waiting':
                return '使用微信扫一扫登录'
            case 'expired':
                return '二维码已过期，请刷新'
            case 'error':
                return errorMsg || '加载失败，请重试'
            case 'success':
                return '登录成功，正在跳转...'
            default:
                return '使用微信扫一扫登录'
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="blur-sm pointer-events-none">
                    <HomePage />
                </div>
            </div>

            <div className="absolute inset-0 z-10 flex justify-center items-center">
                <div className="w-[440px] h-[620px] relative overflow-hidden rounded-lg group"
                    style={{
                        background: `radial-gradient(circle at 50% 0%, rgba(45, 52, 102, 0.5) 0%, transparent 60%),
                                    linear-gradient(180deg, #0f1123 0%, #04050b 100%)`,
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                    }}
                >
                    <div className="flex flex-col items-center pt-[60px] relative z-10">
                        <header className="mb-[40px]">
                            <img 
                                src="/logo.png" 
                                alt="芸起" 
                                className="h-[60px] object-contain"
                                style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 85, 255, 0.4))' }}
                            />
                        </header>

                        <div className="w-[330px] rounded-2xl flex flex-col items-center py-[35px] pb-[45px] relative z-10"
                            style={{
                                background: 'linear-gradient(145deg, rgba(26, 28, 51, 0.95) 0%, rgba(17, 18, 33, 0.95) 100%)',
                                backdropFilter: 'blur(10px)',
                                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.03)'
                            }}
                        >
                            <div className="text-white text-base font-medium mb-[35px] relative pb-2 tracking-wider">
                                微信登录
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] rounded"
                                    style={{
                                        background: 'linear-gradient(90deg, #a053db 0%, #4c62fb 100%)',
                                        boxShadow: '0 1px 4px rgba(76, 98, 251, 0.4)'
                                    }}
                                />
                            </div>

                            <div className="bg-white p-2 rounded-md relative mb-[40px]"
                                style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)' }}
                            >
                                {status === 'loading' ? (
                                    <div className="w-[170px] h-[170px] flex items-center justify-center bg-gray-100 rounded">
                                        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        <img
                                            src={qrCodeUrl}
                                            alt="微信登录二维码"
                                            className="w-[170px] h-[170px] block"
                                        />
                                        {(status === 'expired' || status === 'error') && (
                                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded">
                                                <button
                                                    onClick={handleRefresh}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-gray-800 hover:bg-gray-100 transition-colors"
                                                >
                                                    <IconRefresh size={16} />
                                                    刷新二维码
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-lg flex justify-center items-center"
                                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                                >
                                    <img src="/icon.png" alt="芸起" className="w-6 h-6 object-contain" />
                                </div>
                            </div>

                            <div className={`text-sm tracking-wide ${status === 'expired' || status === 'error' ? 'text-red-400' : 'text-[#797c8f]'}`}>
                                {getStatusText()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoginPage
