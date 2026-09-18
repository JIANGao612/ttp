import React, {useRef, useEffect} from 'react';
import {
    Copy, Image as ImageIcon, Trash2, EyeOff, Eye, Merge, CheckSquare,
} from 'lucide-react';

export interface ContextMenuProps {
    x: number;
    y: number;
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
    onClose: () => void;
    onCopy: () => void;
    onCopyAsImage: () => void;
    onDeleteRows: () => void;
    onHideRows: () => void;
    onUnhideRows: () => void;
    onMerge: () => void;
    onSelectAll: () => void;
    hiddenRows: Set<number>;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
                                                     x, y, startRow, endRow, startCol, endCol,
                                                     onClose, onCopy, onCopyAsImage,
                                                     onDeleteRows, onHideRows, onUnhideRows, onMerge, onSelectAll,
                                                     hiddenRows,
                                                 }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    const minR = Math.min(startRow, endRow) + 1;
    const maxR = Math.max(startRow, endRow) + 1;
    const rowLabel = minR === maxR ? `第${minR}行` : `第${minR}-${maxR}行`;
    const isMultiCell = startRow !== endRow || startCol !== endCol;

    const hasHiddenRows = (() => {
        const sR = Math.min(startRow, endRow);
        const eR = Math.max(startRow, endRow);
        for (let r = sR; r <= eR; r++) {
            if (hiddenRows.has(r)) return true;
        }
        return false;
    })();

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    const menuItemCls = 'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer select-none';
    const shortcutCls = 'ml-auto text-xs text-gray-400';

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-52 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            style={{left: x, top: y}}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* 分组1: 编辑操作 */}
            <div className={menuItemCls} onClick={() => {
                onSelectAll();
                onClose();
            }}>
                <CheckSquare size={15}/> 全选<span className={shortcutCls}>Ctrl+A</span>
            </div>
            <div className={menuItemCls} onClick={() => {
                onCopy();
                onClose();
            }}>
                <Copy size={15}/> 复制<span className={shortcutCls}>Ctrl+C</span>
            </div>
            <div className={menuItemCls} onClick={() => {
                onCopyAsImage();
                onClose();
            }}>
                <ImageIcon size={15}/> 复制为图片
            </div>

            <div className="my-1 h-px bg-gray-200"/>

            {/* 分组2: 行列操作 */}
            {hasHiddenRows ? (
                <div className={menuItemCls} onClick={() => {
                    onUnhideRows();
                    onClose();
                }}>
                    <Eye size={15}/> 取消隐藏{rowLabel}
                </div>
            ) : (
                <div className={menuItemCls} onClick={() => {
                    onHideRows();
                    onClose();
                }}>
                    <EyeOff size={15}/> 隐藏{rowLabel}
                </div>
            )}
            <div className={menuItemCls} onClick={() => {
                onDeleteRows();
                onClose();
            }}>
                <Trash2 size={15}/> 删除{rowLabel}
            </div>

            <div className="my-1 h-px bg-gray-200"/>

            {/* 分组3: 其他 */}
            <div
                className={isMultiCell ? menuItemCls : `${menuItemCls} cursor-not-allowed opacity-40`}
                onClick={() => {
                    if (isMultiCell) {
                        onMerge();
                        onClose();
                    }
                }}
            >
                <Merge size={15}/> 合并单元格
            </div>
        </div>
    );
};

export default ContextMenu;