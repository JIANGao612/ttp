/**
 * 数据上传 API
 *
 * 改动说明：
 *  - 移除原来的 batchUploadData（接收 downloadUrl）
 *  - 新增 uploadFiles：用 FormData 直接传文件到后端
 */
import {apiClient} from '@client/src/utils/axios';
import type {
    BatchUploadResponse,
    UploadRecordListResponse,
    ClearRecentDataResponse,
    UploadMode,
} from '@shared/api.interface';

/**
 * 上传文件（multipart/form-data）
 *
 * @param files     File[] 数组
 * @param uploadMode 'paired' | 'hourly_noon' | ...
 * @param onProgress 可选：进度回调（目前后端不推送百分比，保留接口位置）
 */
export async function uploadFiles(
    files: File[],
    uploadMode: UploadMode,
    onProgress?: (percent: number, stage: string) => void,
): Promise<BatchUploadResponse> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('uploadMode', uploadMode);

    onProgress?.(10, '上传中');
    const {data} = await apiClient.post<BatchUploadResponse>(
        '/data-upload/upload-files',
        formData,
        {
            headers: {'Content-Type': 'multipart/form-data'},
            timeout: 10 * 60 * 1000, // 10 分钟超时，匹配后端
        },
    );
    onProgress?.(100, '完成');
    return data;
}

/** 上传历史列表 */
export async function getUploadRecords(params: {
    page: number;
    pageSize: number;
}): Promise<{ data: UploadRecordListResponse }> {
    const res = await apiClient.get<UploadRecordListResponse>('/data-upload/records', {params});
    return {data: res.data};
}

/** 清空近 8 日数据 */
export async function clearRecentData(): Promise<ClearRecentDataResponse> {
    const {data} = await apiClient.post<ClearRecentDataResponse>('/data-upload/clear-recent');
    return data;
}