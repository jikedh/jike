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
