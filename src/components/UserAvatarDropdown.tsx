import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { clearJikeingToken, getJikeingToken } from '@/utils/utils'
// import { getJikeingToken, clearJikeingToken } from '@/utils/aiRequest'

interface UserAvatarDropdownProps {
    userId?: string
    nickname?: string
}

const AVATAR_STYLES = [
    'adventurer',
    'adventurer-neutral',
    'avataaars',
    'big-ears',
    'big-smile',
    'bottts',
    'croodles',
    'fun-emoji',
]

const generateAvatarUrl = (seed: string, style: string = 'adventurer') => {
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`
}

const getRandomStyle = (seed: string) => {
    const index = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_STYLES.length
    return AVATAR_STYLES[index]
}

export const UserAvatarDropdown = ({ userId, nickname }: UserAvatarDropdownProps) => {
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const token = getJikeingToken()
    const userSeed = userId || 'default-user'
    const avatarStyle = getRandomStyle(userSeed)
    const avatarUrl = generateAvatarUrl(userSeed, avatarStyle)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = () => {
        clearJikeingToken()
        setIsOpen(false)
        navigate('/login')
    }

    if (!token) {
        return (
            <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex flex-col items-center justify-center rounded-xl px-2 py-3 text-white/50 transition-all hover:bg-white/5 hover:text-white/90"
                title="登录"
            >
                <User size={24} />
            </button>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex flex-col items-center justify-center rounded-xl px-2 py-2 text-white/50 transition-all hover:bg-white/5 hover:text-white/90"
                title={nickname || '用户'}
            >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 p-0.5">
                    <div className="w-full h-full rounded-full overflow-hidden bg-[#0a0a0a]">
                        <img
                            src={avatarUrl}
                            alt={nickname || '用户头像'}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-sm text-white/90 truncate">{nickname || '用户'}</p>
                        <p className="text-xs text-white/40">ID: {userSeed}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <LogOut size={16} />
                        <span>退出登录</span>
                    </button>
                </div>
            )}
        </div>
    )
}

export default UserAvatarDropdown
