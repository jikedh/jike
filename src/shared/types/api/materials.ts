/**
 * 素材模块类型定义
 */

// ===================== 用户端素材 =====================

/** 素材分类项 */
export interface MaterialCategoryItem {
  id: string;
  name: string;
  icon?: string;
  sort?: number;
}

/** 素材项 */
export interface MaterialItem {
  id: string;
  title: string;
  cover: string;
  categoryId?: string;
  categoryName?: string;
  tags?: string[];
  viewCount?: number;
  collectCount?: number;
  createTime?: number;
}

/** 素材列表响应 */
export interface MaterialsListResponse {
  list: MaterialItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 素材详情响应 */
export interface MaterialDetailResponse extends MaterialItem {
  content?: string;
  images?: string[];
  downloadCount?: number;
  author?: string;
}

// ===================== 管理端素材分类 =====================

/** 管理端素材分类项 */
export interface AdminMaterialCategoryItem {
  id: string;
  name: string;
  icon?: string;
  sort: number;
  status: number;
  createTime: string;
  updateTime?: string;
}

/** 管理端素材分类列表响应 */
export interface AdminCategoryListResponse {
  list: AdminMaterialCategoryItem[];
  total: number;
}

/** 创建素材分类请求 */
export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  sort?: number;
  status?: number;
}

/** 更新素材分类请求 */
export interface UpdateCategoryRequest extends CreateCategoryRequest {
  id: string;
}

// ===================== 管理端素材 =====================

/** 管理端素材项 */
export interface AdminMaterialItem {
  id: string;
  title: string;
  cover: string;
  categoryId?: string;
  categoryName?: string;
  content?: string;
  images?: string[];
  tags?: string[];
  status: number;
  viewCount?: number;
  collectCount?: number;
  createTime: string;
  updateTime?: string;
}

/** 管理端素材列表响应 */
export interface AdminMaterialsListResponse {
  list: AdminMaterialItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 创建素材请求 */
export interface CreateMaterialRequest {
  title: string;
  cover: string;
  categoryId?: string;
  content?: string;
  images?: string[];
  tags?: string[];
  status?: number;
}

/** 更新素材请求 */
export interface UpdateMaterialRequest extends CreateMaterialRequest {
  id: string;
}

/** 素材详情响应（管理端） */
export interface MaterialDetailAdminResponse extends AdminMaterialItem {}

// ===================== 课程相关 =====================

/** 课程项 */
export interface CourseItem {
  id: string;
  title: string;
  cover: string;
  description?: string;
  teacher?: string;
  price?: number;
  studentsCount?: number;
  rating?: number;
  createTime?: number;
}

/** 课程列表响应 */
export interface CoursesListResponse {
  list: CourseItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 课程详情响应 */
export interface CourseDetailResponse extends CourseItem {
  chapters?: {
    title: string;
    lessons: {
      id: string;
      title: string;
      duration: number;
      videoUrl?: string;
    }[];
  }[];
}

/** 课程评论项 */
export interface CourseCommentItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  rating: number;
  createTime: number;
}

/** 课程评论列表响应 */
export interface CoursesCommentsResponse {
  list: CourseCommentItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 课程课时项 */
export interface CourseLessonItem {
  id: string;
  title: string;
  duration: number;
  videoUrl?: string;
  freePreview?: boolean;
}

/** 课程课时列表响应 */
export interface CoursesLessonsResponse {
  list: CourseLessonItem[];
}
