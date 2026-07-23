import { getDesktopAudioVoices } from "@/api/jikeGo";
import type {
  AudioTtsModelInfo,
  AudioVoiceProfile,
} from "shared/types/audio";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const AUDIO_VOICE_CACHE_TTL = 24 * 60 * 60 * 1000;

type FetchAudioVoicesOptions = {
  force?: boolean;
  syncMiniMax?: boolean;
};

type FetchAudioVoicesResult = {
  models: AudioTtsModelInfo[];
  syncWarning?: string;
  fromCache: boolean;
};

type AudioVoiceStore = {
  models: AudioTtsModelInfo[];
  lastFetchedAt: number;
  loading: boolean;
  fetchVoices: (
    options?: FetchAudioVoicesOptions,
  ) => Promise<FetchAudioVoicesResult>;
  upsertVoice: (voice: AudioVoiceProfile) => void;
};

let pendingVoiceRequest: Promise<FetchAudioVoicesResult> | null = null;

const unwrapVoiceResponse = (
  response:
    | {
        data?: { models: AudioTtsModelInfo[]; syncWarning?: string };
        models?: AudioTtsModelInfo[];
        syncWarning?: string;
      }
    | undefined,
) => response?.data ?? response;

const isFreshCache = (lastFetchedAt: number, models: AudioTtsModelInfo[]) =>
  models.length > 0 &&
  lastFetchedAt > 0 &&
  Date.now() - lastFetchedAt < AUDIO_VOICE_CACHE_TTL;

export const useAudioVoiceStore = create<AudioVoiceStore>()(
  persist(
    (set, get) => ({
      models: [],
      lastFetchedAt: 0,
      loading: false,

      fetchVoices: async (options = {}) => {
        const { force = false, syncMiniMax = false } = options;
        const current = get();

        if (
          !force &&
          isFreshCache(current.lastFetchedAt, current.models)
        ) {
          return {
            models: current.models,
            fromCache: true,
          };
        }

        if (pendingVoiceRequest) {
          return pendingVoiceRequest;
        }

        set({ loading: true });
        pendingVoiceRequest = getDesktopAudioVoices(syncMiniMax)
          .then((response) => {
            const payload = unwrapVoiceResponse(response);
            const models = payload?.models ?? [];
            set({
              models,
              lastFetchedAt: Date.now(),
              loading: false,
            });
            return {
              models,
              syncWarning: payload?.syncWarning,
              fromCache: false,
            };
          })
          .catch((requestError) => {
            set({ loading: false });
            throw requestError;
          })
          .finally(() => {
            pendingVoiceRequest = null;
          });

        return pendingVoiceRequest;
      },

      upsertVoice: (voice) => {
        set((state) => ({
          models: state.models.map((model) =>
            model.id === voice.model
              ? {
                  ...model,
                  available: true,
                  voices: [
                    ...model.voices.filter(
                      (item) => item.profileId !== voice.profileId,
                    ),
                    voice,
                  ],
                }
              : model,
          ),
        }));
      },
    }),
    {
      name: "audio-voice-catalog",
      partialize: (state) => ({
        models: state.models,
        lastFetchedAt: state.lastFetchedAt,
      }),
    },
  ),
);

export { AUDIO_VOICE_CACHE_TTL };
