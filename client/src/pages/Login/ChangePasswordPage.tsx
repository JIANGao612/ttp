import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button} from '@client/src/components/ui/button';
import {Input} from '@client/src/components/ui/input';
import {apiClient, clearToken, getStoredUser} from '@client/src/utils/axios';
import {toast} from 'sonner';

const ChangePasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // 当前用户信息（用于顶部展示）
    const currentUser = getStoredUser();

    /**
     * 提交修改密码
     * 校验：原密码非空、新密码 ≥ 6 位、两次新密码一致、新密码不能等于原密码
     * 成功后：清 token，跳回登录页重新登录（这样新密码才生效）
     */
    const handleSubmit = async () => {
        if (!oldPassword) {
            toast.error('请输入原密码');
            return;
        }
        if (newPassword.length < 6) {
            toast.error('新密码长度至少 6 位');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('两次输入的新密码不一致');
            return;
        }
        if (newPassword === oldPassword) {
            toast.error('新密码不能与原密码相同');
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/auth/change-password', {
                oldPassword,
                newPassword,
            });
            toast.success('密码修改成功，请重新登录');

            // 清 token 让用户重新登录（避免旧 token 里还带着旧密码相关的信息）
            clearToken();
            setTimeout(() => {
                navigate('/login', {replace: true});
            }, 800);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? '修改密码失败，请重试';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    /** 取消 / 返回首页 */
    const handleCancel = () => {
        navigate('/', {replace: true});
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-96 rounded-lg border border-border bg-card p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-xl font-semibold">修改密码</h1>
                    {/* 只显示当前用户，不再显示"强制"警告 */}
                    <p className="mt-1 text-xs text-muted-foreground">
                        当前用户：{currentUser?.username ?? '未知'}
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                            原密码
                        </label>
                        <Input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="请输入原密码"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                            新密码
                        </label>
                        <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="至少 6 位"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                            确认新密码
                        </label>
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder="请再次输入新密码"
                        />
                    </div>

                    <Button className="w-full" disabled={loading} onClick={handleSubmit}>
                        {loading ? '提交中...' : '确认修改'}
                    </Button>

                    {/* 取消按钮：返回首页 */}
                    <div className="text-center text-xs">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="text-muted-foreground hover:text-primary hover:underline"
                        >
                            返回首页
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordPage;