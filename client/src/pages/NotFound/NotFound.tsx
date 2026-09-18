import React from 'react';
import {Link} from 'react-router-dom';

const NotFound: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
            <p className="text-lg text-muted-foreground">页面不存在</p>
            <Link
                to="/"
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
                返回首页
            </Link>
        </div>
    );
};

export default NotFound;