/**
 * Layout.tsx —— 全局布局组件
 *
 * 职责：
 *  1. 提供左侧侧边栏（Logo + 导航菜单 + 底部用户区）
 *  2. 提供右侧内容区（顶部标题 + 页面内容）
 *  3. 根据当前用户角色动态显示菜单（管理员多一个"用户管理"）
 *  4. 提供"修改密码"和"退出登录"入口
 *
 * 布局结构：
 *  ┌──────────────┬─────────────────────────────────┐
 *  │              │  header（顶部标题）              │
 *  │  侧边栏       ├─────────────────────────────────┤
 *  │  (aside)     │                                 │
 *  │              │  <Outlet />（页面内容）          │
 *  │              │                                 │
 *  └──────────────┴─────────────────────────────────┘
 */

import {Outlet, Link, useLocation, useNavigate} from 'react-router-dom';
import {
    Database,        // 数据源图标
    CalendarClock,   // 日报时报图标
    LogOut,          // 退出登录图标
    User as UserIcon,// 用户图标
    KeyRound,        // 修改密码图标
    Users,           // 用户管理图标
    Upload,
    FileText,
} from 'lucide-react';
import {getStoredUser, clearToken} from '@client/src/utils/axios';

// ============================================================
// 导航菜单配置
// ============================================================

/** 所有登录用户都能看到的菜单 */
const BASE_NAV_ITEMS = [
    {path: '/', label: 'Promote 数据源', icon: Database},
    {path: '/daily-times', label: '日报时报', icon: CalendarClock},
    {path: '/upload', label: '上传数据', icon: Upload},
    {path: '/creative-asset-registry', label: '内审表信息入库', icon: FileText},
];

/** 仅管理员可见的菜单（会追加到 BASE_NAV_ITEMS 后面） */
const ADMIN_NAV_ITEMS = [
    {path: '/admin/users', label: '用户管理', icon: Users},
];

// ============================================================
// 工具函数
// ============================================================

/**
 * 判断某个菜单项是否处于激活状态
 * @param pathname 当前浏览器路径（来自 useLocation）
 * @param itemPath 菜单项的路径
 * @returns 是否激活
 *
 * 规则：
 *  - "/" 只有精确匹配才激活（否则所有路径都会激活它）
 *  - 其他路径：精确匹配 或 以它开头（子路由也算激活）
 */
function isActivePath(pathname: string, itemPath: string): boolean {
    if (itemPath === '/') return pathname === '/';
    return pathname === itemPath || pathname.startsWith(itemPath + '/');
}

// ============================================================
// 主组件
// ============================================================

const Layout = () => {
    const {pathname} = useLocation();      // 当前路径，用于判断菜单激活状态
    const navigate = useNavigate();          // 路由跳转函数
    const user = getStoredUser();            // 从 localStorage 读取当前登录用户
    const isAdmin = user?.role === 'admin';  // 是否管理员

    // 根据角色组装菜单：管理员多一个"用户管理"
    const navItems = isAdmin ? [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS] : BASE_NAV_ITEMS;

    // 顶部标题：从当前激活的菜单项里取 label
    const activeTitle =
        navItems.find((it) => isActivePath(pathname, it.path))?.label ?? '日报时报';

    // ============================================================
    // 事件处理
    // ============================================================

    /** 退出登录：清除 token 并跳转到登录页 */
    const handleLogout = () => {
        if (!window.confirm('确认退出登录？')) return;
        clearToken();                                // 清除 localStorage 里的 token 和 user
        navigate('/login', {replace: true});       // replace 避免用户按返回键回到上一页
    };

    // ============================================================
    // 渲染
    // ============================================================

    return (
        <div className="flex min-h-screen w-full">

            {/* ============================================================
       *  左侧侧边栏
       *  —— flex flex-col 让内部三段式布局：Logo / 菜单 / 用户区
       *  ============================================================ */}
            <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">

                {/* ---------- 顶部：Logo 区 ---------- */}
                <Link
                    to="/"
                    className="flex h-14 items-center gap-2 border-b border-border px-4 hover:bg-accent"
                >
                    {/* TTP 图标 */}
                    <div
                        className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-sm font-bold text-sm tracking-wide">
                        TTP
                    </div>
                    {/* 应用名 + 公司名 */}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">投放数据分析平台</span>
                        <span className="truncate text-xs text-muted-foreground">星邦科技</span>
                    </div>
                </Link>

                {/* ---------- 中部：导航菜单（flex-1 撑满剩余空间） ---------- */}
                <nav className="flex-1 p-2">
                    {navItems.map((item) => {
                        const active = isActivePath(pathname, item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors ${
                                    active
                                        ? 'bg-primary text-primary-foreground font-medium'   // 激活态：蓝底白字
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground' // 普通态
                                }`}
                            >
                                {/* 菜单图标 */}
                                <item.icon className="size-4"/>
                                {/* 菜单文字 */}
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* ---------- 底部：当前用户 + 修改密码 + 退出登录 ---------- */}
                <div className="border-t border-border p-2">

                    {/* 显示当前用户名和角色 */}
                    <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                        <UserIcon className="size-3.5"/>
                        <span className="truncate">
              {user?.username ?? '未知用户'}
                            {/* 管理员额外显示标签 */}
                            {isAdmin && <span className="ml-1 text-primary">（管理员）</span>}
            </span>
                    </div>

                    {/* 修改密码入口：跳转到 /change-password */}
                    <button
                        type="button"
                        onClick={() => navigate('/change-password')}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <KeyRound className="size-4"/>
                        修改密码
                    </button>

                    {/* 退出登录：清 token 后跳登录页 */}
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <LogOut className="size-4"/>
                        退出登录
                    </button>
                </div>
            </aside>

            {/* ============================================================
       *  右侧内容区
       *  ============================================================ */}
            <main className="flex flex-1 flex-col overflow-hidden">

                {/* ---------- 顶部标题栏 ---------- */}
                <header className="flex h-14 items-center border-b border-border px-4">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground">
                        {/* activeTitle 由当前路由动态计算 */}
                        {activeTitle}
                    </h1>
                </header>

                {/* ---------- 页面内容区（Outlet 渲染匹配到的子路由） ---------- */}
                <div className="flex-1 overflow-auto">
                    <Outlet/>
                </div>
            </main>
        </div>
    );
};

export default Layout;