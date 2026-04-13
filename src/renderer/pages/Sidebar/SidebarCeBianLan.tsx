import {
  Film,
  Folder,
  House,
  Mic,
  Settings,
  SquareDashedMousePointer,
  Type,
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

const FIRST_LOGIN_KEY = "jike_first_login_completed";

export const SidebarCeBianLan = () => {
  const navigate = useNavigate();
  const userId = getJikeingUserId();
  const token = getJikeingToken();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFirstLoginModalOpen, setIsFirstLoginModalOpen] = useState(false);

  const { loginStatus, fetchUserInfo, balanceInfo, fetchBalanceInfo } = useUserStore();

  useEffect(() => {
    if (token) {
      fetchUserInfo();
      fetchBalanceInfo();
      const hasCompletedFirstLogin = localStorage.getItem(FIRST_LOGIN_KEY);
      if (!hasCompletedFirstLogin) {
        setIsFirstLoginModalOpen(true);
      }
    }
  }, [token, fetchUserInfo, fetchBalanceInfo]);

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleFirstLoginComplete = () => {
    localStorage.setItem(FIRST_LOGIN_KEY, "true");
    setIsFirstLoginModalOpen(false);
  };

  return (
    <>
      <SidebarRoot defaultActiveId="home">
        <button
          type="button"
          onClick={() => handleNavClick("/home")}
          className="mb-10 flex flex-col items-center justify-center px-2 text-center cursor-pointer group"
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
        </button>

        <SidebarNav classNames={{ root: "flex-1" }}>
          <SidebarNavItem
            id="home"
            icon={<House size={24} />}
            label="首页"
            onClick={() => handleNavClick("/home")}
          />
          <SidebarNavItem
            id="canvas"
            icon={<SquareDashedMousePointer size={24} />}
            label="画布"
            onClick={() => handleNavClick("/canvas")}
          />
          <SidebarNavItem
            id="script"
            icon={<Type size={24} />}
            label="剧本"
            onClick={() => handleNavClick("/script")}
          />
          <SidebarNavItem
            id="assets"
            icon={<Folder size={24} />}
            label="资产库"
            onClick={() => handleNavClick("/assets")}
          />
          <SidebarNavItem
            id="voice"
            icon={<Mic size={24} />}
            label="配音工作室"
            onClick={() => handleNavClick("/voice")}
          />
          <SidebarNavItem
            id="video"
            icon={<Film size={24} />}
            label="短片合成"
            onClick={() => handleNavClick("/video")}
          />
        </SidebarNav>

        <SidebarFooter classNames={{ root: "mt-auto" }}>
          <UserAvatarDropdown userId={userId} balanceInfo={balanceInfo} />
          <SettingsButton onClick={handleSettingsClick} />
        </SidebarFooter>
      </SidebarRoot>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <SettingsModal
        open={isFirstLoginModalOpen}
        onClose={handleFirstLoginComplete}
        isFirstLogin={true}
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
