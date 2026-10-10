import React from 'react';
import ReactDOM from 'react-dom/client';
import {Toaster} from 'sonner'; // 让 toast.success/error 能显示
import App from './App';
// @ts-ignore
import './index.css';

// 简单的错误边界：任何子组件崩溃时，不至于整个页面白屏
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    state = {hasError: false, error: null as Error | null};

    static getDerivedStateFromError(error: Error) {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{padding: 40, fontFamily: 'sans-serif'}}>
                    <h2 style={{color: '#dc2626'}}>页面出错了</h2>
                    <p style={{color: '#666', marginTop: 8}}>
                        {this.state.error?.message ?? '未知错误'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: 16,
                            padding: '6px 16px',
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            cursor: 'pointer',
                        }}
                    >
                        刷新页面
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App/>
            <Toaster position="top-center" richColors/>
        </ErrorBoundary>
    </React.StrictMode>
);