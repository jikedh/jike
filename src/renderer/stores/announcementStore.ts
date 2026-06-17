import { getAnnouncementList, type AnnouncementItem } from "@/api/jikeGo";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const ANNOUNCEMENT_POLL_INTERVAL = 60 * 60 * 1000;

type FetchAnnouncementsOptions = {
  markAsRead?: boolean;
};

type AnnouncementStoreType = {
  announcements: AnnouncementItem[];
  announcementsLoading: boolean;
  hasUnreadAnnouncements: boolean;
  newAnnouncementIds: string[];
  lastSeenAnnouncementKey: string;
  lastFetchedAt: number;
  fetchAnnouncements: (options?: FetchAnnouncementsOptions) => Promise<void>;
  enterAnnouncementCenter: () => void;
  clearNewAnnouncementMarks: () => void;
};

const getAnnouncementTime = (item: AnnouncementItem) => {
  const rawTime = item.update_time || item.created_time;
  const time = rawTime ? new Date(rawTime).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const getLatestAnnouncement = (announcements: AnnouncementItem[]) =>
  [...announcements].sort((a, b) => {
    const timeDiff = getAnnouncementTime(b) - getAnnouncementTime(a);
    if (timeDiff !== 0) return timeDiff;
    return String(b.id).localeCompare(String(a.id));
  })[0] ?? null;

const getAnnouncementKey = (item: AnnouncementItem | null) => {
  if (!item) return "";
  return `${getAnnouncementTime(item)}:${item.id}`;
};

const isAnnouncementNewerThan = (
  item: AnnouncementItem,
  announcementKey: string,
) => {
  if (!announcementKey) return true;
  return getAnnouncementKey(item).localeCompare(announcementKey) > 0;
};

const normalizeAnnouncementList = (res: any): AnnouncementItem[] => {
  const data = res?.data ?? res;
  return Array.isArray(data?.list) ? data.list : [];
};

export const useAnnouncementStore = create<AnnouncementStoreType>()(
  persist(
    (set, get) => ({
      announcements: [],
      announcementsLoading: false,
      hasUnreadAnnouncements: false,
      newAnnouncementIds: [],
      lastSeenAnnouncementKey: "",
      lastFetchedAt: 0,

      fetchAnnouncements: async (options = {}) => {
        set({ announcementsLoading: true });

        try {
          const list = normalizeAnnouncementList(await getAnnouncementList());
          const latestKey = getAnnouncementKey(getLatestAnnouncement(list));
          const nextLastSeenAnnouncementKey = options.markAsRead
            ? latestKey
            : get().lastSeenAnnouncementKey;

          set({
            announcements: list,
            hasUnreadAnnouncements:
              !!latestKey && latestKey !== nextLastSeenAnnouncementKey,
            lastSeenAnnouncementKey: nextLastSeenAnnouncementKey,
            lastFetchedAt: Date.now(),
          });
        } catch {
          set({
            lastFetchedAt: Date.now(),
          });
        } finally {
          set({ announcementsLoading: false });
        }
      },

      enterAnnouncementCenter: () => {
        const {
          announcements,
          lastSeenAnnouncementKey,
          newAnnouncementIds: currentNewAnnouncementIds,
        } = get();
        const latestKey = getAnnouncementKey(getLatestAnnouncement(announcements));
        const newAnnouncementIds = announcements
          .filter((item) => isAnnouncementNewerThan(item, lastSeenAnnouncementKey))
          .map((item) => item.id);

        set({
          hasUnreadAnnouncements: false,
          newAnnouncementIds: [
            ...new Set([...currentNewAnnouncementIds, ...newAnnouncementIds]),
          ],
          lastSeenAnnouncementKey:
            latestKey || get().lastSeenAnnouncementKey,
        });
      },

      clearNewAnnouncementMarks: () => {
        set({ newAnnouncementIds: [] });
      },
    }),
    {
      name: "canvas-announcement-state",
      partialize: (state) => ({
        lastSeenAnnouncementKey: state.lastSeenAnnouncementKey,
      }),
    },
  ),
);

export { ANNOUNCEMENT_POLL_INTERVAL };
