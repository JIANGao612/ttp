import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Button} from '@client/src/components/ui/button';
import {Input} from '@client/src/components/ui/input';
import {apiClient, setToken, setStoredUser} from '@client/src/utils/axios';
import {toast} from 'sonner';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // 控制「忘记密码」弹窗的显示
    const [showForgotModal, setShowForgotModal] = useState(false);

    /**
     * 登录处理
     * 流程：调后端 /auth/login → 拿到 token 和用户信息 → 存 localStorage → 跳首页
     *
     * 注意：这里已去掉「强制改密码」逻辑。
     *      无论用户是否 mustChangePassword，登录后都直接进入首页。
     *      想改密码可以点侧边栏底部的「修改密码」按钮。
     */
    const handleLogin = async () => {
        // ---- 1. 前端基础校验 ----
        if (!username.trim() || !password) {
            toast.error('请输入用户名和密码');
            return;
        }

        setLoading(true);
        try {
            // ---- 2. 调后端登录接口 ----
            const {data} = await apiClient.post('/auth/login', {
                username: username.trim(),
                password,
            });

            // ---- 3. 保存 token 和用户信息到 localStorage ----
            setToken(data.token);
            setStoredUser(data.user);

            // ---- 4. 提示并跳转首页 ----
            toast.success(`欢迎，${data.user.username}`);
            navigate('/', {replace: true});   // replace 避免用户按返回键回到登录页
        } catch (err: any) {
            // ---- 5. 错误处理（后端会返回具体原因，比如"用户名或密码错误"） ----
            const msg = err?.response?.data?.message ?? '登录失败，请重试';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-96 rounded-lg border border-border bg-card p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <div
                        className="mx-auto mb-3 flex size-14 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-lg">
                        TTP
                    </div>
                    <h1 className="text-xl font-semibold">投放数据分析平台</h1>
                    <p className="mt-1 text-xs text-muted-foreground">星邦科技</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                            用户名
                        </label>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            placeholder="请输入姓名"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                            密码
                        </label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            placeholder="请输入密码"
                        />
                    </div>

                    <Button className="w-full" disabled={loading} onClick={handleLogin}>
                        {loading ? '登录中...' : '登录'}
                    </Button>

                    {/* 底部：注册 + 忘记密码 */}
                    <div className="flex items-center justify-between text-xs">
                        <Link to="/register" className="text-primary hover:underline">
                            注册新账号
                        </Link>
                        {/* 从纯文字改成可点击按钮，点击弹出说明 */}
                        <button
                            type="button"
                            onClick={() => setShowForgotModal(true)}
                            className="text-primary hover:underline"
                        >
                            忘记密码？
                        </button>
                    </div>
                </div>
            </div>
            {/* ============================================================
       *  忘记密码弹窗
       *  —— 用自定义 Modal（不依赖 shadcn Dialog，避免组件冲突）
       *  —— 说明管理员重置密码的完整流程
       *  ============================================================ */}
            {showForgotModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setShowForgotModal(false)}
                >
                    <div
                        className="w-[420px] rounded-lg border border-border bg-card p-6 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="mb-3 text-lg font-semibold">忘记密码怎么办？</h3>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>请按以下步骤找回密码：</p>
                            <ol className="ml-4 list-decimal space-y-2">
                                <li>
                                    通过飞书或微信联系管理员
                                    <span className="font-semibold text-foreground">蒋俊</span>
                                </li>
                                <li>告知你的用户名（登录用的姓名）</li>
                                <li>管理员会为你生成一个临时密码，并通过飞书发给你</li>
                                <li>
                                    用临时密码登录后，点击左下角
                                    <span className="font-semibold text-foreground">「修改密码」</span>
                                    设置你自己的新密码
                                </li>
                            </ol>
                            <p className="pt-2 text-xs">
                                ⚠️ 临时密码只用于第一次登录，请尽快改成自己的常用密码。
                            </p>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={() => setShowForgotModal(false)}>
                                我知道了
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;