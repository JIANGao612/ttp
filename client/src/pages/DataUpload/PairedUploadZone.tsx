import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { logger } from '@client/src/utils/logger';
import { uploadFiles } from '@client/src/api/data-upload';
import { validateUploadFile } from '@client/src/utils/upload-validation';
import { getBackendErrorMsg } from '@client/src/utils/backend-error';
import type { BatchUploadFileItem, UnmatchedCreativeDetail } from '@shared/api.interface';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Progress } from '@client/src/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@client/src/components/ui/dialog';
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw, AlertOctagon } from 'lucide-react';
import { TableWithSelection } from '@client/src/components/table-selection';
import { toast } from 'sonner';

interface PairedUploadZoneProps {
    onUploadSuccess: () => void;
}

type SlotStatus = 'empty' | 'selected' | 'uploading' | 'success' | 'error';

interface SlotState {
    file: File | null;
    status: SlotStatus;
    errorMsg?: string;
    validRows?: number;
    totalRows?: number;
}

const ACCEPT_MAP = {
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
};

const formatErrorMsg = (msg: string): string => {
    if (msg.includes('Backend service is not running')) {
        return '文件存储服务暂不可用，请稍后重试或刷新页面后再试';
    }
    if (msg.includes('Network Error') || msg.includes('timeout')) {
        return '网络连接超时，请检查网络后重试';
    }
    return msg;
};

const PairedUploadZone: React.FC<PairedUploadZoneProps> = ({ onUploadSuccess }) => {
    const [dailySlot, setDailySlot] = useState<SlotState>({ file: null, status: 'empty' });
    const [mappingSlot, setMappingSlot] = useState<SlotState>({ file: null, status: 'empty' });
    const [isBusy, setIsBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [unmatchedOpen, setUnmatchedOpen] = useState(false);
    const [unmatchedCost, setUnmatchedCost] = useState<number>(0);
    const [unmatchedDetails, setUnmatchedDetails] = useState<UnmatchedCreativeDetail[]>([]);
    const dailyInputRef = useRef<HTMLInputElement>(null);
    const mappingInputRef = useRef<HTMLInputElement>(null);

    const onDailyDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setDailySlot({ file: acceptedFiles[0], status: 'selected' });
        }
    }, []);

    const onMappingDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setMappingSlot({ file: acceptedFiles[0], status: 'selected' });
        }
    }, []);

    const { getRootProps: getDailyRootProps, getInputProps: getDailyInputProps, isDragActive: dailyDrag } = useDropzone({
        onDrop: onDailyDrop,
        accept: ACCEPT_MAP,
        multiple: false,
        disabled: isBusy,
    });

    const { getRootProps: getMappingRootProps, getInputProps: getMappingInputProps, isDragActive: mappingDrag } = useDropzone({
        onDrop: onMappingDrop,
        accept: ACCEPT_MAP,
        multiple: false,
        disabled: isBusy,
    });

    const handleUpload = async () => {
        if (!dailySlot.file || !mappingSlot.file) return;

        const dailyProblem = validateUploadFile(dailySlot.file);
        if (dailyProblem) { toast.error(dailyProblem); return; }
        const mappingProblem = validateUploadFile(mappingSlot.file);
        if (mappingProblem) { toast.error(mappingProblem); return; }

        setIsBusy(true);
        setProgress(0);
        setDailySlot((s) => ({ ...s, status: 'uploading' }));
        setMappingSlot((s) => ({ ...s, status: 'uploading' }));

        try {
            // ⭐ 直接 FormData 上传两份文件（不再走 Dataloom）
            const result = await uploadFiles(
                [dailySlot.file, mappingSlot.file],
                'paired',
                (percent) => setProgress(percent),
            );

            setProgress(100);

            for (const fr of result.fileResults) {
                const isDaily = fr.fileName === dailySlot.file.name;
                const setter = isDaily ? setDailySlot : setMappingSlot;
                if (fr.success) {
                    setter((s) => ({ ...s, status: 'success', validRows: fr.validRows, totalRows: fr.totalRows }));
                } else {
                    setter((s) => ({ ...s, status: 'error', errorMsg: fr.errorMsg ?? '处理失败' }));
                }
            }

            const successCount = result.fileResults.filter((fr) => fr.success).length;
            if (successCount > 0) {
                toast.success(`上传完成: ${result.validRows} 条有效数据 (${result.dataDateStart} ~ ${result.dataDateEnd})`);
                const otherErrors = (result.errors ?? []).filter((e) => !e.includes('日报数据未匹配到映射记录'));
                if (otherErrors.length > 0) {
                    toast.warning(`${otherErrors.length} 条提示`, { description: otherErrors.slice(0, 5).join('\n') });
                }
                if (result.unmatchedDetails && result.unmatchedDetails.length > 0) {
                    setUnmatchedCost(result.unmatchedCost ?? 0);
                    setUnmatchedDetails(result.unmatchedDetails);
                    setUnmatchedOpen(true);
                }
                onUploadSuccess();
            }
        } catch (err) {
            const rawMsg = err instanceof Error ? err.message : String(err);
            const displayMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? rawMsg;
            logger.error(`Paired 上传失败: ${rawMsg}`);
            setDailySlot((s) => (s.status === 'uploading' ? { ...s, status: 'error', errorMsg: displayMsg } : s));
            setMappingSlot((s) => (s.status === 'uploading' ? { ...s, status: 'error', errorMsg: displayMsg } : s));
            toast.error(`上传失败: ${displayMsg}`);
        }

        setIsBusy(false);
    };

    const handleReset = () => {
        setDailySlot({ file: null, status: 'empty' });
        setMappingSlot({ file: null, status: 'empty' });
        setProgress(0);
    };

    const canUpload = dailySlot.file && mappingSlot.file && !isBusy;

    const renderSlot = (
        label: string,
        hint: string,
        slot: SlotState,
        rootProps: ReturnType<typeof getDailyRootProps>,
        inputProps: ReturnType<typeof getDailyInputProps>,
        dragActive: boolean,
        inputRef: React.RefObject<HTMLInputElement | null>,
    ) => (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{label}</span>
                {slot.status === 'success' && <CheckCircle2 className="size-4 text-green-600" />}
                {slot.status === 'error' && <XCircle className="size-4 text-red-600" />}
                {slot.status === 'uploading' && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>
            <div
                {...rootProps}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                }}
                className={`flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/30'
                } ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
            >
                <input {...inputProps} ref={inputRef} className="sr-only" />
                {slot.file ? (
                    <div className="flex items-center gap-2 text-center">
                        <FileSpreadsheet className="size-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium">{slot.file.name}</p>
                            <p className="text-xs text-muted-foreground">{(slot.file.size / 1024).toFixed(0)} KB</p>
                            {slot.validRows !== undefined && (
                                <p className="text-xs text-muted-foreground">
                                    有效: <span className="font-mono font-medium text-foreground">{slot.validRows}</span> 行
                                </p>
                            )}
                            {slot.errorMsg && <p className="text-xs text-red-600 whitespace-pre-line">{slot.errorMsg}</p>}
                        </div>
                    </div>
                ) : (
                    <>
                        <UploadCloud className="size-8 text-muted-foreground" />
                        {dragActive ? (
                            <p className="text-sm font-medium text-primary">释放文件</p>
                        ) : (
                            <>
                                <p className="text-sm font-medium">拖拽或点击选择</p>
                                <p className="text-xs text-muted-foreground">{hint}</p>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    return (
        <>
            <Dialog open={unmatchedOpen} onOpenChange={setUnmatchedOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <AlertOctagon className="size-5" />
                            {unmatchedDetails.length} 个创意素材ID未匹配到映射记录
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-1">
                                <p>
                                    以下 creative ID 不存在于映射文件中，已以 <span className="font-mono">(unmapped)</span> 标记入库。
                                    波及消耗合计{' '}
                                    <span className="font-mono font-semibold text-foreground">
                    ¥{unmatchedCost.toFixed(2)}
                  </span>
                                    ，请排查映射文件是否需要补全。
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-96 overflow-auto rounded-sm border">
                        <TableWithSelection>
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-accent text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">#</th>
                                    <th className="px-3 py-2 text-left font-medium">Creative ID</th>
                                    <th className="px-3 py-2 text-right font-medium">波及消耗</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y">
                                {unmatchedDetails.map((d, idx) => (
                                    <tr key={d.creativeId} className="hover:bg-accent/30">
                                        <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                                            {idx + 1}
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-xs break-all">{d.creativeId}</td>
                                        <td className="px-3 py-1.5 text-right font-mono text-xs">
                                            ¥{d.cost.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </TableWithSelection>
                    </div>
                    <DialogFooter>
                        <Button size="sm" variant="outline" onClick={() => setUnmatchedOpen(false)}>
                            知道了
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="size-5" />
                        Promote 双文件上传
                        <span className="ml-auto text-xs font-normal text-muted-foreground">
            日报 + 映射
          </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-2 rounded-sm border bg-accent/50 p-3">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        <div className="space-y-1 text-xs">
                            <p className="font-medium text-foreground">同时上传日报文件和映射文件，系统按创意素材ID自动关联合并</p>
                            <p className="text-muted-foreground">日报必须包含: 消耗时间、消耗、展示量、点击量、创意素材ID</p>
                            <p className="text-muted-foreground">映射必须包含: 推广系列名称、推广系列ID、广告组ID、创意素材ID</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {renderSlot(
                            '日报文件',
                            'CSV / XLSX / XLS',
                            dailySlot,
                            getDailyRootProps(),
                            getDailyInputProps(),
                            dailyDrag,
                            dailyInputRef,
                        )}
                        {renderSlot(
                            '映射文件',
                            'CSV / XLSX / XLS',
                            mappingSlot,
                            getMappingRootProps(),
                            getMappingInputProps(),
                            mappingDrag,
                            mappingInputRef,
                        )}
                    </div>

                    {isBusy && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在处理...
              </span>
                                <span className="font-mono text-xs">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <Button
                            size="sm"
                            disabled={!canUpload}
                            onClick={() => void handleUpload()}
                        >
                            {isBusy ? (
                                <><Loader2 className="mr-1.5 size-3.5 animate-spin" />处理中...</>
                            ) : (
                                <><UploadCloud className="mr-1.5 size-3.5" />开始上传</>
                            )}
                        </Button>
                        {(dailySlot.file || mappingSlot.file) && !isBusy && (
                            <Button size="sm" variant="outline" onClick={handleReset}>
                                <RefreshCw className="mr-1.5 size-3.5" />
                                重置
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </>
    );
};

export default PairedUploadZone;
