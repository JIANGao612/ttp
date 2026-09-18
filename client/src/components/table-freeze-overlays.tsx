import React from 'react';
import type {TableFreezeApi} from '@client/src/hooks/use-table-freeze';

interface TableFreezeOverlaysProps {
    freeze: TableFreezeApi;
    showRowDivider?: boolean;
}

const TableFreezeOverlays: React.FC<TableFreezeOverlaysProps> = ({freeze, showRowDivider = true}) => (
    <>
        <div
            className="absolute top-0 bottom-0 w-2 cursor-col-resize z-50 group"
            style={{left: freeze.colDividerX - 4}}
            onPointerDown={freeze.startColDrag}
            title="拖动冻结列"
        >
            <div
                className="mx-auto h-full w-0.5 bg-transparent group-hover:bg-primary group-active:bg-primary transition-colors"/>
        </div>
        {freeze.colDragX !== null && (
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-50 pointer-events-none"
                style={{left: freeze.colDragX}}
            />
        )}
        {showRowDivider && (
            <div
                className="absolute left-0 right-0 h-2 cursor-row-resize z-50 group flex items-center"
                style={{top: freeze.rowDividerY - 4}}
                onPointerDown={freeze.startRowDrag}
                title="拖动冻结行"
            >
                <div
                    className="h-0.5 w-full bg-transparent group-hover:bg-primary group-active:bg-primary transition-colors"/>
            </div>
        )}
        {showRowDivider && freeze.rowDragY !== null && (
            <div
                className="absolute left-0 right-0 h-0.5 bg-primary z-50 pointer-events-none"
                style={{top: freeze.rowDragY}}
            />
        )}
    </>
);

export default TableFreezeOverlays;
