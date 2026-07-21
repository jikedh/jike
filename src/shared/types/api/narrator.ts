export type NarratorApiEnvelope<T> = {
  code?: number;
  message?: string;
  msg?: string;
  data?: T;
  total?: number;
  limit?: number;
  page?: number;
};

export type NarratorMaterial = {
  unique_code: string;
  name: string;
  cover?: string;
  models?: string[];
  created_at?: string;
};

export type NarratorMaterialPage = {
  items: NarratorMaterial[];
  total: number;
  limit: number;
  page: number;
};

export type NarratorOptionItem = {
  name: string;
  value: string;
  avatar_url?: string;
  res_url?: string;
};

export type NarratorModelOptions = {
  id: string;
  label: string;
  fontSize: NarratorOptionItem[];
  fontStyle: NarratorOptionItem[];
  dubbing: NarratorOptionItem[];
  cover: NarratorOptionItem[];
  bgm: NarratorOptionItem[];
};

export type NarratorCreateTaskRequest = {
  model: string;
  title: string;
  dubbing: string;
  font_size: string;
  font_style: string;
  cover: string;
  bgm: string;
};

export type NarratorCreateTaskResponse = {
  task_num: string;
};

export type NarratorTaskStatus = 1 | 2 | 9 | -1 | -9 | 10;

export type NarratorTaskDetail = {
  task_num: string;
  playlet_name?: string;
  cover?: string;
  status: NarratorTaskStatus;
  created_at?: string;
  end_time?: string;
  video_url?: string;
  project_zip?: string;
  error?: string;
};

export type LocalNarratorTask = NarratorTaskDetail & {
  local_created_at: number;
  model: string;
  dubbing: string;
  font_size: string;
  font_style: string;
  cover_style: string;
  bgm: string;
};
