import type { LocalNarratorTask } from "shared/types/api/narrator";

const STORAGE_PREFIX = "jike.shortDramaCommentary.tasks.v1";

const getStorageKey = (userId: string) =>
  `${STORAGE_PREFIX}.${userId.trim() || "anonymous"}`;

const sortTasks = (tasks: LocalNarratorTask[]) =>
  [...tasks].sort((a, b) => b.local_created_at - a.local_created_at);

export const loadLocalNarratorTasks = (userId: string): LocalNarratorTask[] => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortTasks(
      parsed.filter((item): item is LocalNarratorTask =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof item.task_num === "string" &&
          typeof item.local_created_at === "number",
        ),
      ),
    );
  } catch {
    return [];
  }
};

export const saveLocalNarratorTasks = (
  userId: string,
  tasks: LocalNarratorTask[],
) => {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(sortTasks(tasks)));
};

export const upsertLocalNarratorTask = (
  userId: string,
  task: LocalNarratorTask,
) => {
  const current = loadLocalNarratorTasks(userId);
  const next = [
    task,
    ...current.filter((item) => item.task_num !== task.task_num),
  ];
  saveLocalNarratorTasks(userId, next);
  return next;
};

export const removeLocalNarratorTask = (userId: string, taskNum: string) => {
  const next = loadLocalNarratorTasks(userId).filter(
    (item) => item.task_num !== taskNum,
  );
  saveLocalNarratorTasks(userId, next);
  return next;
};
