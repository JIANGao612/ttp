import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Button} from '@client/src/components/ui/button';
import {Input} from '@client/src/components/ui/input';
import {apiClient} from '@client/src/utils/axios';
import {toast} from 'sonner';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!username.trim()) {
            toast.error('请输入姓名');
            return;
        }
        if (password.length < 6) {
            toast.error('密码长度至少 6 位');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('两次输入的密码不一致');
            return;
        }
        setLoading(true);
        try {
            const {data} = await apiClient.post('/auth/register', {
                username: username.trim(),
                password,
            });
            toast.success(data.message, {duration: 6000});
            navigate('/login', {replace: true});
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? '注册失败，请重试';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-96 rounded-lg border border-border bg-card p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-xl font-semibold">注册账号</h1>
                    <p className="mt-1 text-xs text-muted-foreground">请使用真实姓名注册</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">姓名</label>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入姓名"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">密码</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="至少 6 位"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">确认密码</label>
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                            placeholder="请再次输入密码"
                        />
                    </div>

                    <Button className="w-full" disabled={loading} onClick={handleRegister}>
                        {loading ? '注册中...' : '注册'}
                    </Button>

                    <div className="text-center text-xs">
                        <Link to="/login" className="text-primary hover:underline">
                            已有账号？去登录
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;