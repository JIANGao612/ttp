import React, {useCallback, useEffect, useState} from 'react';
import {UserX, UserCheck, KeyRound, RefreshCw, Copy} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {apiClient} from '@client/src/utils/axios';
import {toast} from 'sonner';

interface UserItem {
    id: string;
    username: string;
    role: string;
    status: string;
    lastLoginAt: string | null;
    createdAt: string;
}

function fmtTime(s: string | null): string {
    if (!s) return '从未登录';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${hh}:${mm}`;
}

const UserManagementPage: React.FC = () => {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState<string | null>(null);
    const [tempPassword, setTempPassword] = useState<{ username: string; password: string } | null>(null);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const {data} = await apiClient.get<{ items: UserItem[] }>('/auth/users');
            setUsers(data.items);
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? '加载用户列表失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const handleDisable = async (user: UserItem) => {
        if (!window.confirm(`确认禁用用户「${user.username}」？禁用后该用户将无法登录。`)) return;
        try {
            await apiClient.post(`/auth/users/${user.id}/disable`);
            toast.success(`已禁用「${user.username}」`);
            void loadUsers();
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? '禁用失败');
        }
    };

    const handleEnable = async (user: UserItem) => {
        try {
            await apiClient.post(`/auth/users/${user.id}/enable`);
            toast.success(`已启用「${user.username}」`);
            void loadUsers();
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? '启用失败');
        }
    };

    const handleResetPassword = async (user: UserItem) => {
        if (!window.confirm(
            `确认重置「${user.username}」的密码？\n\n系统会生成一个临时密码，请通过飞书发给该用户。\n用户用临时密码登录后，可自行修改密码。`,
        )) return;
        setResetting(user.id);
        try {
            const {data} = await apiClient.post<{ tempPassword: string }>(
                `/auth/users/${user.id}/reset-password`,
            );
            setTempPassword({username: user.username, password: data.tempPassword});
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? '重置失败');
        } finally {
            setResetting(null);
        }
    };

    const handleCopy = async () => {
        if (!tempPassword) return;
        try {
            await navigator.clipboard.writeText(tempPassword.password);
            toast.success('已复制临时密码');
        } catch {
            toast.error('复制失败，请手动选中复制');
        }
    };

    const total = users.length;
    const activeCount = users.filter((u) => u.status === 'active').length;
    const disabledCount = users.filter((u) => u.status === 'disabled').length;

    return (
        <div className="flex flex-col gap-4">
            {/* 顶部统计 */}
            <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card p-4">
                <div className="flex items-center gap-6 text-sm">
                    <div>
                        <span className="text-muted-foreground">总用户：</span>
                        <span className="font-semibold">{total}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">正常：</span>
                        <span className="font-semibold text-emerald-600">{activeCount}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">已禁用：</span>
                        <span className="font-semibold text-red-500">{disabledCount}</span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={loadUsers}
                    disabled={loading}
                >
                    <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`}/>
                    刷新
                </Button>
            </div>

            {/* 用户表格 */}
            <div className="rounded-sm border border-border bg-card">
                {loading ? (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        加载中...
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        暂无用户
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border bg-accent">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    用户名
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    角色
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    状态
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    最后登录
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    注册时间
                                </th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    操作
                                </th>
                            </tr>
                            </thead>
                            <tbody>
                            {users.map((u) => {
                                const isAdmin = u.role === 'admin';
                                const isDisabled = u.status === 'disabled';
                                return (
                                    <tr
                                        key={u.id}
                                        className="border-b border-border last:border-0 hover:bg-accent/50"
                                    >
                                        <td className="px-4 py-2.5 font-medium">
                                            {u.username}
                                            {isAdmin && (
                                                <span
                                                    className="ml-2 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            管理员
                          </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                            {isAdmin ? '管理员' : '普通用户'}
                                        </td>
                                        <td className="px-4 py-2.5">
                        <span
                            className={`rounded-sm px-1.5 py-0.5 text-[11px] ${
                                isDisabled
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-emerald-50 text-emerald-600'
                            }`}
                        >
                          {isDisabled ? '已禁用' : '正常'}
                        </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                            {fmtTime(u.lastLoginAt)}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                            {fmtTime(u.createdAt)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                {isDisabled ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEnable(u)}
                                                        className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"
                                                        title="启用用户"
                                                    >
                                                        <UserCheck className="size-3.5"/>
                                                        启用
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isAdmin}
                                                        onClick={() => handleDisable(u)}
                                                        className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                                                        title={isAdmin ? '不能禁用管理员' : '禁用用户'}
                                                    >
                                                        <UserX className="size-3.5"/>
                                                        禁用
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={resetting === u.id}
                                                    onClick={() => handleResetPassword(u)}
                                                    className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                                                    title="重置密码"
                                                >
                                                    <KeyRound className="size-3.5"/>
                                                    重置密码
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 临时密码弹窗 */}
            {tempPassword && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setTempPassword(null)}
                >
                    <div
                        className="w-[420px] rounded-lg border border-border bg-card p-6 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="mb-3 text-lg font-semibold">✅ 临时密码已生成</h3>

                        {/* 操作步骤说明 */}
                        <div className="mb-4 space-y-2 text-xs text-muted-foreground">
                            <p className="text-sm text-foreground">
                                用户：<span className="font-semibold">{tempPassword.username}</span>
                            </p>
                            <p>请按以下步骤操作：</p>
                            <ol className="ml-4 list-decimal space-y-1">
                                <li>点击下方「复制密码」按钮</li>
                                <li>
                                    通过飞书/微信把密码发给
                                    <span className="font-semibold text-foreground">{tempPassword.username}</span>
                                </li>
                                <li>用户用该密码登录后，可自行修改密码</li>
                            </ol>
                        </div>

                        {/* 密码展示区 */}
                        <div className="mb-4 rounded-sm border border-border bg-accent p-4">
                            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                                临时密码
                            </div>
                            <div className="select-all font-mono text-lg font-semibold tracking-wider">
                                {tempPassword.password}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setTempPassword(null)}>
                                关闭
                            </Button>
                            <Button size="sm" className="gap-1.5" onClick={handleCopy}>
                                <Copy className="size-3.5"/>
                                复制密码
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagementPage;