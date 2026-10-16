/**
 * App.tsx —— 前端路由总入口
 *
 * 职责：
 *  1. 定义整个应用的路由表
 *  2. 区分「公开路由」和「受保护路由」
 *  3. 挂载全局 Provider（如 DashboardProvider）
 *
 * 路由结构说明：
 *  ┌─ 公开路由（无需登录）
 *  │   ├── /login          登录页
 *  │   └── /register       注册页
 *  │
 *  └─ 受保护路由（需要登录，由 AuthGuard 拦截）
 *      ├── /change-password     修改密码页（独立全屏，不带侧边栏）
 *      └── <Layout>             带左侧边栏的主应用
 *          ├── <DashboardProvider>  共享筛选状态的路由组
 *          │   ├── /                    首页：Promote 数据源
 *          │   └── /daily-times         日报时报
 *          └── /admin/users             用户管理（管理员专用）
 */

import React from 'react';
import {BrowserRouter, Route, Routes} from 'react-router-dom';

// ============ 布局与守卫 ============
import Layout from './components/Layout';           // 侧边栏 + 内容区布局
import AuthGuard from './components/AuthGuard';     // 登录守卫：未登录自动跳 /login

// ============ 公开页面 ============
import NotFound from './pages/NotFound/NotFound';   // 404 页面
import LoginPage from './pages/Login/LoginPage';           // 登录页
import RegisterPage from './pages/Login/RegisterPage';     // 注册页

// ============ 受保护页面 ============
import ChangePasswordPage from './pages/Login/ChangePasswordPage';   // 修改密码（独立全屏）
import UserManagementPage from './pages/Admin/UserManagementPage';   // 用户管理（管理员专用）
import DataUpload from './pages/DataUpload/DataUpload';

// ============ 业务页面 ============
import {DashboardProvider} from './pages/shared/DashboardContext'; // 全局筛选状态 Provider
import DataSource from './pages/DataSource/DataSource';              // 数据源页面
import DailyTimes from './pages/DailyTimes/DailyTimes';              // 日报时报页面
import CreativeAssetRegistry from './pages/CreativeAssetRegistry/CreativeAssetRegistry';

const RoutesComponent = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* ============================================================
         *  第一层：公开路由
         *  —— 不需要登录就能访问，一般只有登录和注册
         *  ============================================================ */}
                <Route path="/login" element={<LoginPage/>}/>
                <Route path="/register" element={<RegisterPage/>}/>

                {/* ============================================================
         *  第二层：受保护路由
         *  —— 由 <AuthGuard /> 统一拦截
         *  —— 未登录用户会被重定向到 /login
         *  ============================================================ */}
                <Route element={<AuthGuard/>}>

                    {/* ------------------------------------------------------------
           *  2.1 修改密码页
           *  —— 独立全屏页面，不带侧边栏
           *  —— 场景 A：用户主动点"修改密码"
           *  —— 场景 B：管理员重置密码后，用户首次登录被强制跳转到这里
           *  ------------------------------------------------------------ */}
                    <Route path="/change-password" element={<ChangePasswordPage/>}/>

                    {/* ------------------------------------------------------------
           *  2.2 主应用（带侧边栏）
           *  —— <Layout /> 提供左侧导航 + 顶部标题 + 右侧内容区
           *  ------------------------------------------------------------ */}
                    <Route element={<Layout/>}>

                        {/* 2.2.1 需要共享筛选状态的路由组
             *   —— <DashboardProvider> 提供全局 filters，页面切换时筛选条件保留 */}
                        <Route element={<DashboardProvider/>}>
                            {/* 首页：默认展示"Promote 数据源" */}
                            <Route index element={<DataSource/>}/>
                            {/* 日报时报页 */}
                            <Route path="daily-times" element={<DailyTimes/>}/>
                            {/* 数据上传页 */}
                            <Route path="upload" element={<DataUpload/>}/>
                            <Route path="creative-asset-registry" element={<CreativeAssetRegistry/>}/>
                        </Route>

                        {/* 2.2.2 用户管理页（管理员专用）
             *   —— 侧边栏只在管理员登录时才显示"用户管理"菜单
             *   —— 普通用户即使手动输入 URL，AuthGuard 也会拦截（见 AuthGuard.tsx）
             *   —— 这一层不放在 DashboardProvider 里，因为它不需要筛选状态 */}
                        <Route path="admin/users" element={<UserManagementPage/>}/>
                    </Route>
                </Route>

                {/* ============================================================
         *  第三层：兜底 404
         *  —— 所有未匹配的路由都跳到 NotFound 页面
         *  ============================================================ */}
                <Route path="*" element={<NotFound/>}/>
            </Routes>
        </BrowserRouter>
    );
};

export default RoutesComponent;