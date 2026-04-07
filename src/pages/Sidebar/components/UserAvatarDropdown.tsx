import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { clearJikeingToken, getJikeingToken } from '@/utils/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  // 读取登录态 token，决定是展示头像下拉还是跳转登录入口
    const token = getJikeingToken()
    const userSeed = userId || 'default-user'
    const avatarStyle = getRandomStyle(userSeed)
    const avatarUrl = generateAvatarUrl(userSeed, avatarStyle)

  // 退出登录：清理 token 后返回登录页
    const handleLogout = () => {
      clearJikeingToken()
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-xl px-2 py-2 text-white/50 transition-all hover:bg-white/5 hover:text-white/90"
            title={nickname || '用户'}
          >
            <div className="h-10 w-10 overflow-hidden rounded-full bg-linear-to-br from-purple-500 to-blue-500 p-0.5">
              <div className="h-full w-full overflow-hidden rounded-full bg-[#0a0a0a]">
                <img
                  src={avatarUrl}
                  alt={nickname || '用户头像'}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>

        {/* 固定在头像右侧展示，避免再使用手写 absolute + 外部点击逻辑 */}
        <DropdownMenuContent
          side="right"
          align="end"
          sideOffset={10}
          className="z-50 w-60  overflow-hidden rounded-xl border border-white/10 bg-[#171717] p-0 text-white shadow-2xl ring-white/10"
        >
          <div className="border-b border-white/10 bg-linear-to-b from-white/3 to-transparent px-4 py-3">
            <p className="truncate text-sm font-medium text-white/90">{nickname || '用户'}</p>
            <p className="mt-1 text-xs text-white/40">ID: {userSeed}</p>
          </div>

          <DropdownMenuItem
            onSelect={handleLogout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-none px-4 py-3 text-sm text-white/75 focus:bg-white/8 focus:text-white"
          >
            <LogOut size={16} />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
}

export default UserAvatarDropdown
