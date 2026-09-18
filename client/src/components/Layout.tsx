import {Outlet, Link, useLocation} from 'react-router-dom';
import {Database, CalendarClock} from 'lucide-react';

const NAV_ITEMS = [
    {path: '/', label: 'Promote 数据源', icon: Database},
    {path: '/daily-times', label: '日报时报', icon: CalendarClock},
];

function getActiveTitle(pathname: string): string {
    const item = NAV_ITEMS.find((it) =>
        it.path === '/' ? pathname === '/' : pathname.startsWith(it.path),
    );
    return item?.label ?? '日报时报';
}

function isActivePath(pathname: string, itemPath: string): boolean {
    if (itemPath === '/') return pathname === '/';
    return pathname === itemPath || pathname.startsWith(itemPath + '/');
}

const Layout = () => {
    const {pathname} = useLocation();
    const activeTitle = getActiveTitle(pathname);

    return (
        <div className="flex min-h-screen w-full">
            {/* 侧边栏 */}
            <aside className="w-56 shrink-0 border-r border-border bg-card">
                {/* Logo 区 */}
                <Link
                    to="/"
                    className="flex h-14 items-center gap-2 border-b border-border px-4 hover:bg-accent"
                >
                    <div
                        className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-sm font-bold text-sm tracking-wide">
                        TTP
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">投放数据分析平台</span>
                        <span className="truncate text-xs text-muted-foreground">星邦科技</span>
                    </div>
                </Link>

                {/* 导航菜单 */}
                <nav className="p-2">
                    {NAV_ITEMS.map((item) => {
                        const active = isActivePath(pathname, item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors ${
                                    active
                                        ? 'bg-primary text-primary-foreground font-medium'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                }`}
                            >
                                <item.icon className="size-4"/>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* 内容区 */}
            <main className="flex flex-1 flex-col overflow-hidden">
                <header className="flex h-14 items-center border-b border-border px-4">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground">
                        {activeTitle}
                    </h1>
                </header>
                <div className="flex-1 overflow-auto">
                    <Outlet/>
                </div>
            </main>
        </div>
    );
};

export default Layout;