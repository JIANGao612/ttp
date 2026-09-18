import {apiClient} from '@client/src/utils/axios';
import type {UserPreference, UserPreferenceBatchResponse} from '@shared/api.interface';

export async function getUserPreference(key: string): Promise<UserPreference | null> {
    const res = await apiClient.get<UserPreference | null>(
        `/user-preferences/${encodeURIComponent(key)}`,
    );
    return res.data;
}

export async function getUserPreferencesBatch(
    keys: string[],
): Promise<UserPreferenceBatchResponse> {
    const res = await apiClient.get<UserPreferenceBatchResponse>('/user-preferences/batch', {
        params: {keys: keys.join(',')},
    });
    return res.data;
}

export async function setUserPreference(key: string, value: string): Promise<UserPreference> {
    const res = await apiClient.put<UserPreference>(
        `/user-preferences/${encodeURIComponent(key)}`,
        {key, value},
    );
    return res.data;
}

export async function deleteUserPreference(key: string): Promise<void> {
    await apiClient.delete(`/user-preferences/${encodeURIComponent(key)}`);
}

// ────────────────────────────────────────────────────────────
// 兼容 ColumnPresetManager.tsx 的调用方式（userPreferences.xxx）
// 原本这个对象来自 @client/src/api 桶文件，本地开发时直接在这导出
// ────────────────────────────────────────────────────────────
export const userPreferences = {
    getUserPreference,
    getUserPreferencesBatch,
    setUserPreference,
    deleteUserPreference,
};