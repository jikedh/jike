import { jikeingService } from "service/aiRequest";

const JIKE_GO_BASE_URL =
    import.meta.env.VITE_JIKE_GO_BASE_URL || "http://localhost:9181";

export type FeedbackCategory =
    | "suggestion"
    | "bug"
    | "complaint"
    | "consultation";

type ApiEnvelope<T> = {
    code?: number;
    msg?: string;
    message?: string;
    data?: T;
};

export type CreateFeedbackRequest = {
    category: FeedbackCategory;
    title: string;
    content: string;
    contact?: string;
    attachmentKeys: string[];
    appVersion: string;
    osVersion: string;
    currentPage: string;
    diagnosticConsent: boolean;
};

export type FeedbackAttachmentUpload = {
    key: string;
    url: string;
    filename: string;
    size: number;
    contentType: string;
};

export type FeedbackHistoryItem = {
    id: string;
    category: FeedbackCategory;
    title: string;
    status: "pending" | "processing" | "resolved" | "closed";
    replyContent?: string | null;
    resolutionContent?: string | null;
    closeReason: string;
    createdAt: number;
    updatedAt: number;
};

export type FeedbackAttachment = {
    id: string;
    url: string;
    filename: string;
    mimeType: string;
    fileSize: number;
};

export type FeedbackDetail = FeedbackHistoryItem & {
    content: string;
    contact: string;
    attachments: FeedbackAttachment[];
};

export type FeedbackHistoryResponse = {
    list: FeedbackHistoryItem[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
};

const request = async <T>(config: Parameters<typeof jikeingService.request>[0]) => {
    return (await jikeingService.request({
        baseURL: JIKE_GO_BASE_URL,
        ...config,
    })) as unknown as ApiEnvelope<T>;
};

export const uploadFeedbackAttachment = (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<FeedbackAttachmentUpload>({
        url: "/v1/feedbacks/attachments",
        method: "post",
        data,
    });
};

export const createFeedback = (data: CreateFeedbackRequest) =>
    request<{ id: string; status: string }>({
        url: "/v1/feedbacks",
        method: "post",
        data,
    });

export const getMyFeedbackHistory = (page: number) =>
    request<FeedbackHistoryResponse>({
        url: "/v1/feedbacks",
        method: "get",
        params: { page },
    });

export const getMyFeedbackDetail = (id: string) =>
    request<FeedbackDetail>({
        url: `/v1/feedbacks/${encodeURIComponent(id)}`,
        method: "get",
    });
