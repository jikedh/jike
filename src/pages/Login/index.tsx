import { useState, useEffect } from 'react'
import HomePage from '@/pages/Home'

const LoginPage = () => {
    const [qrCodeUrl, setQrCodeUrl] = useState('')

    useEffect(() => {
        const timestamp = Date.now()
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=https://okjike.com/login?t=${timestamp}&color=000000&bgcolor=FFFFFF`)
    }, [])

    return (
        <div className="relative min-h-screen overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="blur-sm pointer-events-none">
                    <HomePage />
                </div>
            </div>

            <div className="absolute inset-0 z-10 flex justify-center items-center">
                <div className="w-[440px] h-[620px] relative overflow-hidden rounded-lg"
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
                                {qrCodeUrl && (
                                    <img
                                        src={qrCodeUrl}
                                        alt="微信登录二维码"
                                        className="w-[170px] h-[170px] block"
                                    />
                                )}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-lg flex justify-center items-center"
                                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                                >
                                    <div className="w-[18px] h-[18px] rounded-full relative -rotate-45"
                                        style={{ background: 'linear-gradient(135deg, #00d2ff 0%, #ff3366 100%)' }}
                                    >
                                        <div className="absolute bottom-[2px] right-[2px] w-3 h-3 bg-[#0055ff] rounded-full" />
                                    </div>
                                </div>
                            </div>

                            <div className="text-[#797c8f] text-sm tracking-wide">
                                使用微信扫一扫登录
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoginPage
