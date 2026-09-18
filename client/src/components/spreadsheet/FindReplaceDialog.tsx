import React, {useState, useEffect, useRef} from 'react';
import {X, Search, ArrowRight} from 'lucide-react';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@client/src/components/ui/dialog';

interface FindReplaceDialogProps {
    open: boolean;
    mode: 'find' | 'replace';
    onClose: () => void;
    onFindReplace: (find: string, replace: string, action: 'find' | 'replace' | 'replaceAll') => number;
}

const FindReplaceDialog: React.FC<FindReplaceDialogProps> = ({open, mode, onClose, onFindReplace}) => {
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [message, setMessage] = useState('');
    const findInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setTimeout(() => findInputRef.current?.focus(), 50);
            setMessage('');
        }
    }, [open]);

    const handleFind = () => {
        const count = onFindReplace(findText, replaceText, 'find');
        setMessage(count > 0 ? `找到 ${count} 处匹配` : '未找到匹配项');
    };

    const handleReplace = () => {
        const count = onFindReplace(findText, replaceText, 'replace');
        setMessage(count > 0 ? `已替换 1 处` : '未找到匹配项');
    };

    const handleReplaceAll = () => {
        const count = onFindReplace(findText, replaceText, 'replaceAll');
        setMessage(`已全部替换 ${count} 处`);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="w-[480px] p-0">
                <DialogHeader className="border-b px-4 py-3">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-sm font-medium">查找和替换</DialogTitle>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded p-1 hover:bg-gray-100"
                        >
                            <X size={16}/>
                        </button>
                    </div>
                </DialogHeader>
                <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                        <label className="w-16 text-xs text-gray-600">查找内容：</label>
                        <input
                            ref={findInputRef}
                            type="text"
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                            placeholder="输入要查找的内容"
                        />
                    </div>
                    {mode === 'replace' && (
                        <div className="flex items-center gap-2">
                            <label className="w-16 text-xs text-gray-600">替换为：</label>
                            <input
                                type="text"
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                placeholder="输入替换内容"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={handleFind}
                            disabled={!findText}
                            className="flex items-center gap-1 rounded bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Search size={14}/> 查找全部
                        </button>
                        {mode === 'replace' && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleReplace}
                                    disabled={!findText}
                                    className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ArrowRight size={14}/> 替换
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReplaceAll}
                                    disabled={!findText}
                                    className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    全部替换
                                </button>
                            </>
                        )}
                    </div>
                    {message && (
                        <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            {message}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default FindReplaceDialog;
