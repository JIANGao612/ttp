import React from 'react';
import {ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@client/src/components/ui/select';

// 定义组件接收的Props，包括当前状态和事件处理函数。
interface EnhancedPaginationProps {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
}

const EnhancedPagination: React.FC<EnhancedPaginationProps> = ({
                                                                   page,
                                                                   totalPages,
                                                                   total,
                                                                   onPageChange,
                                                               }) => {
    // 当总页数≤1时，只显示总记录数，不显示分页控件，优化用户体验。
    if (totalPages <= 1) {
        return (
            <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">共 {total} 条记录</span>
            </div>
        );
    }

    // 生成完整的页码列表，用于下拉选择器。
    const pageOptions: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
        pageOptions.push(i);
    }

    // 计算当前页附近2页的页码范围，用于显示中间按钮。这样在大量页面时只显示部分页码，避免过多按钮。
    const nearbyPages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) {
        nearbyPages.push(i);
    }

    return (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">
        共 {total} 条记录，第 {page}/{totalPages} 页
      </span>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={page <= 1}
                    onClick={() => onPageChange(1)}
                >
                    <ChevronsLeft className="size-3.5"/>
                    首页
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeft className="size-3.5"/>
                </Button>
                {nearbyPages.map((p) => (
                    <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 min-w-[28px] px-1.5 text-xs"
                        onClick={() => onPageChange(p)}
                    >
                        {p}
                    </Button>
                ))}
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                >
                    <ChevronRight className="size-3.5"/>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(totalPages)}
                >
                    <ChevronsRight className="size-3.5"/>
                    尾页
                </Button>
                <div className="ml-2 flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">跳至</span>
                    <Select
                        value={String(page)}
                        onValueChange={(v) => onPageChange(Number(v))}
                    >
                        <SelectTrigger className="h-7 w-[68px] text-xs">
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent className="max-h-[240px]">
                            {pageOptions.map((p) => (
                                <SelectItem key={p} value={String(p)} className="text-xs">
                                    第{p}页
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">页</span>
                </div>
            </div>
        </div>
    );
};

export default EnhancedPagination;
