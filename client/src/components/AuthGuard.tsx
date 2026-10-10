/**
 * AuthGuard.tsx —— 路由登录守卫
 *
 * 职责：
 *  1. 检查用户是否已登录（localStorage 里是否有 token）
 *  2. 未登录 → 重定向到 /login
 *  3. 检查管理员页面权限：普通用户不能访问 /admin/*
 *
 * 使用方式：
 *  在 App.tsx 中作为父路由的 element，包裹所有需要登录的路由：
 *  <Route element={<AuthGuard />}>
 *    <Route path="xxx" element={<XXX />} />
 *  </Route>
 */

import React from 'react';
import {Navigate, Outlet, useLocation} from 'react-router-dom';
import {getToken, getStoredUser} from '@client/src/utils/axios';

const AuthGuard: React.FC = () => {
    const token = getToken();                  // 从 localStorage 读取 token
    const location = useLocation();            // 当前访问的路径
    const user = getStoredUser();              // 当前用户信息

    // ---------- 检查 1：未登录 ----------
    if (!token) {
        // 重定向到登录页，并把当前路径记住（将来可支持登录后跳回原页）
        return <Navigate to="/login" replace state={{from: location.pathname}}/>;
    }

    // ---------- 检查 2：普通用户访问管理员页面 ----------
    if (location.pathname.startsWith('/admin') && user?.role !== 'admin') {
        // 直接踢回首页
        return <Navigate to="/" replace/>;
    }

    // ---------- 通过所有检查：渲染子路由 ----------
    return <Outlet/>;
};

export default AuthGuard;