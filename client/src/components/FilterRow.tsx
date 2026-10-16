import React, {useLayoutEffect, useRef, useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Popover, PopoverContent, PopoverTrigger} from '@client/src/components/ui/popover';
import {cn} from '@/lib/utils';

interface FilterRowProps {
    items: React.ReactNode[];
    actions?: React.ReactNode;
    preCollapsed?: React.ReactNode[];
    preCollapsedActiveCount?: number;
    gap?: number;
}

const MORE_BTN_WIDTH = 96;

const FilterRow: React.FC<FilterRowProps> = ({
                                                 items,
                                                 actions,
                                                 preCollapsed = [],
                                                 preCollapsedActiveCount = 0,
                                                 gap = 8,
                                             }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const [containerW, setContainerW] = useState(0);
    const [widths, setWidths] = useState<number[]>([]);
    const [actionsW, setActionsW] = useState(0);
    const [open, setOpen] = useState(false);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return undefined;
        const ro = new ResizeObserver((entries) => {
            for (const en of entries) setContainerW(en.contentRect.width);
        });
        ro.observe(el);
        setContainerW(el.clientWidth);
        return () => ro.disconnect();
    }, []);

    useLayoutEffect(() => {
        const ws: number[] = items.map((_: React.ReactNode, i: number) => itemRefs.current[i]?.offsetWidth ?? 0);
        const aw: number = actionsRef.current?.offsetWidth ?? 0;
        setWidths((prev: number[]) =>
            prev.length === ws.length && prev.every((v: number, i: number) => Math.abs(v - ws[i]) < 1) ? prev : ws,
        );
        setActionsW((prev: number) => (Math.abs(prev - aw) < 1 ? prev : aw));
    });

    const total = items.length;
    const hasPre = preCollapsed.length > 0;
    const sumAll = widths.reduce((a: number, b: number) => a + b, 0) + gap * Math.max(0, total - 1);
    const available = containerW - actionsW - (actions ? gap : 0);

    let visibleCount = total;
    if (containerW > 0 && widths.length === total) {
        const fitsAll = !hasPre && sumAll <= available;
        if (!fitsAll) {
            const reserve = MORE_BTN_WIDTH + gap;
            let acc = 0;
            let n = 0;
            for (let i = 0; i < total; i += 1) {
                const next = acc + (n > 0 ? gap : 0) + widths[i];
                if (next + reserve <= available) {
                    acc = next;
                    n += 1;
                } else {
                    break;
                }
            }
            visibleCount = n;
        }
    }

    const showMore = hasPre || visibleCount < total;
    const overflow = items.slice(visibleCount);

    return (
        <div className="relative">
            <div ref={containerRef} className="flex items-end" style={{gap}}>
                {items.slice(0, visibleCount).map((node: React.ReactNode, i: number) => (
                    <div key={`v-${i}`} className="shrink-0">{node}</div>
                ))}
                {showMore && (
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                data-ai-section-type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 gap-1 text-xs"
                            >
                                更多筛选
                                {!open && preCollapsedActiveCount > 0 && (
                                    <span
                                        className="rounded-sm bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                    {preCollapsedActiveCount}
                  </span>
                                )}
                                <ChevronDown
                                    className={cn('size-3 transition-transform duration-150', open && 'rotate-180')}/>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[600px] max-w-[92vw] p-2">
                            <div className="grid grid-cols-2 gap-2">
                                {overflow.map((node: React.ReactNode, i: number) => (
                                    <React.Fragment key={`o-${i}`}>{node}</React.Fragment>
                                ))}
                                {preCollapsed.map((node: React.ReactNode, i: number) => (
                                    <React.Fragment key={`p-${i}`}>{node}</React.Fragment>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
                {actions && (
                    <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
                )}
            </div>
            <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 flex" style={{gap}}>
                {items.map((node: React.ReactNode, i: number) => (
                    <div
                        key={`m-${i}`}
                        className="shrink-0"
                        ref={(el: HTMLDivElement | null) => {
                            itemRefs.current[i] = el;
                        }}
                    >
                        {node}
                    </div>
                ))}
                <div ref={actionsRef} className="flex shrink-0 items-center gap-2">{actions ?? null}</div>
            </div>
        </div>
    );
};

export default FilterRow;
