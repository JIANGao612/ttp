// 保持返回 AxiosResponse 风格，与 ad-data.ts / market-consumption.ts 一致
import {apiClient} from '@/utils/axios';
import type {
    TeamMemberMapping,
    TeamMemberMappingListResponse,
    TeamMemberMappingCreateDto,
    TeamMemberMappingUpdateDto,
    MemberDataDetailResponse,
    RollbackStatusResponse,
} from '@shared/api.interface';

const paramsSerializer = {
    serialize: (p: Record<string, unknown>) => {
        const sp = new URLSearchParams();
        Object.entries(p).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            if (Array.isArray(value)) {
                value.forEach((v) => sp.append(key, String(v)));
            } else {
                sp.append(key, String(value));
            }
        });
        return sp.toString();
    },
};

export const listTeamMembers = (params: { page?: number; pageSize?: number }) =>
    apiClient.get<TeamMemberMappingListResponse>(
        '/team-member-mapping',
        {params, paramsSerializer},
    );

export const createTeamMember = (data: TeamMemberMappingCreateDto) =>
    apiClient.post<{ id: string }>('/team-member-mapping', data);

export const updateTeamMember = (id: string, data: TeamMemberMappingUpdateDto) =>
    apiClient.put<{ id: string }>(`/team-member-mapping/${id}`, data);

export const deleteTeamMember = (id: string) =>
    apiClient.delete<{ success: boolean }>(`/team-member-mapping/${id}`);

export const getMemberDataDetail = (params: {
    startDate?: string;
    endDate?: string;
    memberName?: string;
    groupName?: string;
}) =>
    apiClient.get<MemberDataDetailResponse>(
        '/team-member-mapping/detail',
        {params, paramsSerializer},
    );

export const getLatestDataDate = () =>
    apiClient.get<{ latestDataDate: string }>(
        '/team-member-mapping/latest-data-date',
    );

export const recompute = (data?: { startDate?: string; endDate?: string }) =>
    apiClient.post<{ success: boolean; count?: number; dates?: string[]; mode?: string }>(
        '/team-member-mapping/recompute',
        data ?? {},
    );

export const rollbackAll = () =>
    apiClient.post<{ started: boolean; alreadyRunning: boolean }>(
        '/team-member-mapping/rollback-all',
    );

export const getRollbackStatus = () =>
    apiClient.get<RollbackStatusResponse>(
        '/team-member-mapping/rollback-status',
    );

export const validateTeamMemberCode = (params: {
    codeName: string;
    memberName: string;
    excludeId?: string;
}) =>
    apiClient.get<{ valid: boolean; conflict?: string }>(
        '/team-member-mapping/validate-code',
        {params, paramsSerializer},
    );

export const syncTeamLeaders = (data: { leaders: Array<{ memberName: string; leaderName: string }> }) =>
    apiClient.post<{ updated: number }>(
        '/team-member-mapping/sync-leaders',
        data,
    );

export const getGroupNames = () =>
    apiClient.get<{ groupNames: string[] }>(
        '/team-member-mapping/group-names',
    );

export type {TeamMemberMapping};