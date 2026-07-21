import {
  BookOpenText,
  Clapperboard,
  Folder,
  House,
  Settings,
  SquareDashedMousePointer,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJikeingToken, getJikeingUserId } from "shared/utils/utils";
import iconImg from "@/assets/icon.png";
import { SettingsModal } from "@/pages/Canvas/components/SettingsModal";
import { UserAvatarDropdown } from "@/pages/Sidebar/components/UserAvatarDropdown";
import { useUserStore } from "@/stores/useUserStore";
import { SidebarFooter } from "./components/SidebarFooter";
import { SidebarNav } from "./components/SidebarNav";
import { SidebarNavItem } from "./components/SidebarNavItem";
import { SidebarRoot } from "./components/SidebarRoot";

export const SidebarCeBianLan = () => {
  const navigate = useNavigate();
  const userId = getJikeingUserId();
  const token = getJikeingToken();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  const { loginStatus, fetchUserInfo, balanceInfo, fetchBalanceInfo } =
    useUserStore();

  useEffect(() => {
    let isMounted = true;
    const getAppVersion = window.debug?.getAppVersion;

    if (!getAppVersion) {
      return () => {
        isMounted = false;
      };
    }

    getAppVersion()
      .then((version) => {
        if (isMounted) {
          setAppVersion(version);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAppVersion("");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (token) {
      fetchUserInfo();
      fetchBalanceInfo();
      // 画布设置中心的"首次登录欢迎"弹窗已下线：
      // 首次进入应用（无论登录与否）都直接进入主界面，不再自动弹出。
    }
  }, [token, fetchUserInfo, fetchBalanceInfo]);

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const navItems = [
    {
      id: "home",
      icon: <House size={24} />,
      label: "首页",
      path: "/home",
    },
    {
      id: "canvas",
      icon: <SquareDashedMousePointer size={24} />,
      label: "项目",
      path: "/canvas",
    },
    // {
    //   id: "script",
    //   icon: <Type size={24} />,
    //   label: "剧本",
    //   path: "/script",
    // },
    {
      id: "story",
      icon: <BookOpenText size={24} />,
      label: "故事创作",
      path: "/story",
    },
    {
      id: "video-to-script",
      icon: <Video size={24} />,
      label: "视频转剧本",
      path: "/video-to-script",
    },
    {
      id: "assets",
      icon: <Folder size={24} />,
      label: "资产库",
      path: "/assets",
    },
    // {
    //   id: "short-drama-commentary",
    //   icon: <Clapperboard size={24} />,
    //   label: "短剧解说",
    //   path: "/short-drama-commentary",
    // },
    // {
    //   id: "voice",
    //   icon: <Mic size={24} />,
    //   label: "配音工作室",
    //   path: "/voice",
    // },
    /* 暂时隐藏短片合成入口，后续恢复时取消注释即可。 */
    // {
    //   id: "video",
    //   icon: <Film size={24} />,
    //   label: "短片合成",
    //   path: "/video",
    // },
  ];

  return (
    <>
      <SidebarRoot defaultActiveId="home">
        <button
          type="button"
          onClick={() => handleNavClick("/home")}
          className="mb-10 flex shrink-0 flex-col items-center justify-center px-2 text-center cursor-pointer group"
        >
          <div className="w-10 h-10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <img
              src={iconImg}
              alt="即刻"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-[14px] text-white/90 leading-tight font-normal tracking-widest mt-1">
            即刻
          </span>
          {appVersion && (
            <span className="mt-1 text-[10px] leading-none text-white/35 tracking-normal">
              v{appVersion}
            </span>
          )}
        </button>

        <SidebarNav classNames={{ root: "flex-1" }}>
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.id}
              id={item.id}
              icon={item.icon}
              label={item.label}
              onClick={() => handleNavClick(item.path)}
            />
          ))}
        </SidebarNav>

        <SidebarFooter classNames={{ root: "pt-4" }}>
          <UserAvatarDropdown userId={userId} balanceInfo={balanceInfo} />
          <SettingsButton onClick={handleSettingsClick} />
        </SidebarFooter>
      </SidebarRoot>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};

interface SettingsButtonProps {
  onClick: () => void;
}

const SettingsButton = ({ onClick }: SettingsButtonProps) => (
  <button
    className="flex flex-col items-center justify-center rounded-xl px-2 py-2 text-white/50 transition-all hover:bg-white/5 hover:text-white/90"
    onClick={onClick}
  >
    <Settings className="w-5 h-5" />
    <span className="text-[10px] text-white/30 mt-0.5">设置</span>
  </button>
);
