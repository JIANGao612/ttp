import {useEffect} from 'react';
import type {RefObject} from 'react';
import {createColumnResizeDom} from '@client/src/utils/column-resize-dom';
import {initResizeHoverLine} from '@client/src/utils/resize-hover-line';

export function useColumnResizeDom(
    containerRef: RefObject<HTMLElement | null>,
): void {
    useEffect(() => {
        initResizeHoverLine();
        const container = containerRef.current;
        if (!container) return undefined;
        return createColumnResizeDom(container);
    }, [containerRef]);
}
