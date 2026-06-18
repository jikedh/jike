import { ChevronRight, KeyRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getJikeGoUserInfo,
  updateJikeGoUserInfo,
  uploadOssFile,
  type UpdateJikeGoUserInfoRequest,
} from "@/api/jikeGo";
import { PasswordDialog } from "./components/PasswordDialog";
import {
  ProfileEditDialog,
  type ProfileEditField,
} from "./components/ProfileEditDialog";
import { ProfileHeader } from "./components/ProfileHeader";
import {
  PROFILE_INFO_ICONS,
  ProfileInfoCard,
  type ProfileInfoItem,
} from "./components/ProfileInfoCard";
import { getAvatarUrl } from "./lib/avatar";

interface ProfileData {
  id: string;
  uuid: string;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  mobile: string;
  vipLevel: number;
  createTime: number;
}

const SUCCESS_CODES = new Set([200, 10000]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPT_AVATAR_MIME = ["image/png", "image/jpeg", "image/webp"];

const isSuccess = (code: number | undefined) =>
  code === undefined || SUCCESS_CODES.has(code);

// 时间戳（秒/毫秒兼容）→ "yyyy年M月"
const formatRegisteredAt = (timestamp: number): string => {
  if (!timestamp) return "";
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
};

const buildVipLabel = (vipLevel: number) => {
  if (vipLevel >= 3) return "PRO MEMBER";
  if (vipLevel >= 1) return "MEMBER";
  return "";
};

const ProfilePage = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editField, setEditField] = useState<ProfileEditField | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res: any = await getJikeGoUserInfo();
      if (!isSuccess(res?.code)) {
        throw new Error(res?.msg || "获取用户信息失败");
      }
      const data = res?.data ?? {};
      setProfile({
        id: String(data.id ?? ""),
        uuid: String(data.uuid ?? ""),
        username: data.username ?? "",
        nickname: data.nickname ?? "",
        avatar: data.avatar ?? "",
        email: data.email ?? "",
        mobile: data.mobile ?? "",
        vipLevel: Number(data.vip_level ?? 0),
        createTime: Number(data.create_time ?? 0),
      });
    } catch (err: any) {
      toast.error(err?.message || "获取用户信息失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleEditSubmit = useCallback(
    async (field: ProfileEditField, value: string) => {
      const payload: UpdateJikeGoUserInfoRequest = { [field]: value };
      const res: any = await updateJikeGoUserInfo(payload);
      if (!isSuccess(res?.code)) {
        throw new Error(res?.msg || "保存失败");
      }
      toast.success("已保存");
      // 直接更新本地状态，无需重新拉取
      setProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    [],
  );

  const handlePickAvatar = useCallback(
    async (file: File) => {
      // 文件类型 / 大小校验
      if (!ACCEPT_AVATAR_MIME.includes(file.type)) {
        toast.error("仅支持 PNG / JPG / WEBP 格式");
        return;
      }
      if (file.size > MAX_AVATAR_BYTES) {
        toast.error("头像图片不能超过 5MB");
        return;
      }

      setAvatarUploading(true);
      try {
        const uploadRes: any = await uploadOssFile(file);
        if (!isSuccess(uploadRes?.code)) {
          throw new Error(uploadRes?.msg || "图片上传失败");
        }
        const url: string = uploadRes?.data?.url || uploadRes?.data?.URL || "";
        if (!url) throw new Error("上传成功但未返回图片地址");

        const updateRes: any = await updateJikeGoUserInfo({ avatar: url });
        if (!isSuccess(updateRes?.code)) {
          throw new Error(updateRes?.msg || "更新头像失败");
        }
        toast.success("头像已更新");
        // 直接更新本地状态，无需重新拉取
        setProfile((prev) => (prev ? { ...prev, avatar: url } : prev));
      } catch (err: any) {
        toast.error(err?.message || "头像更新失败");
      } finally {
        setAvatarUploading(false);
      }
    },
    [],
  );

  const fallbackAvatar = useMemo(
    () => getAvatarUrl(profile?.uuid || profile?.id || "default-user"),
    [profile?.uuid, profile?.id],
  );

  const infoItems = useMemo<ProfileInfoItem[]>(() => {
    if (!profile) return [];
    return [
      {
        key: "nickname",
        icon: PROFILE_INFO_ICONS.nickname,
        label: "自定义昵称",
        value: profile.nickname || "未设置",
        editable: true,
      },
      {
        key: "email",
        icon: PROFILE_INFO_ICONS.email,
        label: "邮箱",
        value: profile.email || "未绑定",
        editable: true,
        actionText: profile.email ? "更换" : "绑定",
      },
      {
        key: "mobile",
        icon: PROFILE_INFO_ICONS.phone,
        label: "手机号",
        value: profile.mobile || "未绑定",
        editable: true,
        actionText: profile.mobile ? "更换" : "绑定",
      },
    ];
  }, [profile]);

  const handleInfoAction = useCallback((key: string) => {
    if (key === "nickname" || key === "email" || key === "mobile") {
      setEditField(key);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] text-white/60">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#B43FEB]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadProfile();
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          重新加载
        </button>
      </div>
    );
  }

  const editInitialValue =
    editField === "nickname"
      ? profile.nickname
      : editField === "email"
        ? profile.email
        : editField === "mobile"
          ? profile.mobile
          : "";

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <ProfileHeader
        avatarUrl={profile.avatar}
        fallbackAvatarUrl={fallbackAvatar}
        nickname={profile.nickname}
        username={profile.username}
        userId={profile.uuid || profile.id}
        vipLabel={buildVipLabel(profile.vipLevel)}
        registeredAt={formatRegisteredAt(profile.createTime)}
        uploading={avatarUploading}
        onPickAvatar={handlePickAvatar}
      />

      <main className="mx-auto max-w-5xl px-8 py-10">
        <section className="space-y-3">
          <header className="flex items-end justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-white/80">
              基础信息
            </h2>
            <span className="text-[11px] text-white/30">
              点击右侧按钮可修改对应信息
            </span>
          </header>
          <ProfileInfoCard items={infoItems} onAction={handleInfoAction} />
        </section>

        <section className="mt-8 space-y-3">
          <header className="flex items-end justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-white/80">
              安全设置
            </h2>
          </header>
          <ul className="overflow-hidden rounded-2xl border border-white/5 bg-[#121214]">
            <li
              className="group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
              onClick={() => setPasswordOpen(true)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B43FEB]/15 text-[#B43FEB]">
                <KeyRound className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm text-white/90">登录密码</span>
                <span className="mt-0.5 text-xs text-white/40">
                  定期更换密码可提升账户安全
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-white/40 transition-colors group-hover:text-white/80">
                设置
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </li>
          </ul>
        </section>
      </main>

      <ProfileEditDialog
        open={editField !== null}
        field={editField}
        initialValue={editInitialValue}
        onOpenChange={(open) => !open && setEditField(null)}
        onSubmit={handleEditSubmit}
      />
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
};

export default ProfilePage;
