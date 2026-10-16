import React, {useState, useCallback, useRef} from 'react';
import {useDropzone} from 'react-dropzone';
import { logger } from '@client/src/utils/logger';
import { uploadFiles } from '@client/src/api/data-upload';
import {validateUploadFile} from '@client/src/utils/upload-validation';
import {getBackendErrorMsg} from '@client/src/utils/backend-error';
import type {UploadMode} from '@shared/api.interface';
import {Card, CardContent, CardHeader, CardTitle} from '@client/src/components/ui/card';
import {Button} from '@client/src/components/ui/button';
import {Progress} from '@client/src/components/ui/progress';
import {Alert, AlertDescription} from '@client/src/components/ui/alert';
import {UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Loader2, AlertTriangle} from 'lucide-react';
import {toast} from 'sonner';

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileItem {
    name: string;
    status: FileStatus;
    errorMsg?: string;
    validRows?: number;
    dateRange?: string;
    warnings?: string[];
}

interface ModeConfig {
    label: string;
    time: string;
    filesHint: string;
    actionHint: string;
    willDelete: boolean;
}

interface UploadZoneProps {
    uploadMode: UploadMode;
    modeConfig: ModeConfig;
    onUploadSuccess: () => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({
                                                   uploadMode,
                                                   modeConfig,
                                                   onUploadSuccess,
                                               }) => {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [overallProgress, setOverallProgress] = useState(0);
    const [stageLabel, setStageLabel] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const formatErrorMsg = (msg: string): string => {
        if (msg.includes('Backend service is not running')) {
            return '文件存储服务暂不可用，请稍后重试或刷新页面后再试';
        }
        if (msg.includes('Network Error') || msg.includes('timeout')) {
            return '网络连接超时，请检查网络后重试';
        }
        return msg;
    };

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            // 1. 校验文件
            const validFiles: File[] = [];
            const invalidItems: FileItem[] = [];
            for (const f of acceptedFiles) {
                const problem = validateUploadFile(f);
                if (problem) invalidItems.push({ name: f.name, status: 'error', errorMsg: problem });
                else validFiles.push(f);
            }
            setFiles([
                ...validFiles.map((f) => ({ name: f.name, status: 'pending' as FileStatus })),
                ...invalidItems,
            ]);
            if (invalidItems.length > 0) {
                toast.error(`${invalidItems.length} 个文件未上传：${invalidItems[0]!.errorMsg}`);
            }
            if (validFiles.length === 0) return;

            setIsBusy(true);
            setOverallProgress(0);
            setStageLabel('上传中');

            try {
                // ⭐ 直接 FormData 一次性传所有文件（不再有 Dataloom 中转）
                const result = await uploadFiles(validFiles, uploadMode, (percent, stage) => {
                    setOverallProgress(percent);
                    setStageLabel(stage);
                });

                // 3. 更新每个文件的状态
                setFiles((prev) =>
                    prev.map((item) => {
                        const fileResult = result.fileResults.find((fr) => fr.fileName === item.name);
                        if (fileResult) {
                            if (fileResult.success) {
                                return {
                                    ...item,
                                    status: 'success',
                                    validRows: fileResult.validRows,
                                    dateRange: `${result.dataDateStart} ~ ${result.dataDateEnd}`,
                                    warnings: fileResult.errors,
                                };
                            }
                            return { ...item, status: 'error', errorMsg: fileResult.errorMsg ?? '处理失败' };
                        }
                        return item;
                    }),
                );

                const successCount = result.fileResults.filter((fr) => fr.success).length;
                if (successCount > 0) {
                    toast.success(`上传完成: ${successCount}/${validFiles.length} 个文件成功, 共 ${result.validRows} 条有效数据`);
                    const allWarnings = result.errors ?? [];
                    if (allWarnings.length > 0) {
                        toast.warning(`部分单元格格式异常（${allWarnings.length}个），已使用默认值`, {
                            description: allWarnings.slice(0, 5).join('\n'),
                        });
                    }
                    onUploadSuccess();
                } else {
                    toast.error('所有文件处理失败');
                }
            } catch (err) {
                const rawMsg = err instanceof Error ? err.message : String(err);
                const displayMsg = formatErrorMsg(
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? rawMsg,
                );
                logger.error(`上传失败: ${rawMsg}`);
                setFiles((prev) =>
                    prev.map((item) =>
                        item.status === 'pending' || item.status === 'uploading'
                            ? { ...item, status: 'error', errorMsg: displayMsg }
                            : item,
                    ),
                );
                toast.error(`上传失败: ${displayMsg}`);
            }

            setOverallProgress(100);
            setIsBusy(false);
        },
        [onUploadSuccess, uploadMode],
    );

    const {getRootProps, getInputProps, isDragActive} = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
        },
        multiple: true,
        disabled: isBusy,
    });

    const handleReset = () => {
        setFiles([]);
        setOverallProgress(0);
    };

    const successCount = files.filter((f) => f.status === 'success').length;
    const errorCount = files.filter((f) => f.status === 'error').length;
    const allDone = files.length > 0 && !isBusy;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="size-5"/>
                    {modeConfig.label} · 文件上传
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
            {modeConfig.time} · 支持多文件
          </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-2 rounded-sm border bg-accent/50 p-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600"/>
                    <div className="space-y-1 text-xs">
                        <p className="font-medium text-foreground">{modeConfig.filesHint}</p>
                        <p className={modeConfig.willDelete ? 'text-amber-700' : 'text-muted-foreground'}>
                            {modeConfig.actionHint}
                        </p>
                    </div>
                </div>

                <div
                    {...getRootProps()}
                    role="button"
                    tabIndex={0}
                    className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed p-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/30'
                    } ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
                >
                    <input {...getInputProps()} ref={inputRef}/>
                    <UploadCloud className="size-10 text-muted-foreground"/>
                    {isDragActive ? (
                        <p className="text-sm font-medium text-primary">释放文件以上传</p>
                    ) : (
                        <>
                            <p className="text-sm font-medium">拖拽文件到此处，或点击选择文件（可多选）</p>
                            <p className="text-xs text-muted-foreground">支持 CSV / XLSX / XLS 格式，多文件一次性提交</p>
                            <Button size="sm" className="mt-1" onClick={(e) => {
                                e.stopPropagation();
                                inputRef.current?.click();
                            }}>
                                选择文件
                            </Button>
                        </>
                    )}
                </div>

                {isBusy && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin"/>
                  {stageLabel || '正在处理文件...'}
              </span>
                            <span className="font-mono text-xs">{overallProgress}%</span>
                        </div>
                        <Progress value={overallProgress} className="h-2"/>
                    </div>
                )}

                {files.length > 0 && (
                    <div className="space-y-2">
                        {files.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 rounded-sm border p-3">
                                <div className="mt-0.5 shrink-0">
                                    {item.status === 'success' && <CheckCircle2 className="size-5 text-green-600"/>}
                                    {item.status === 'error' && <XCircle className="size-5 text-red-600"/>}
                                    {item.status === 'uploading' && (
                                        <Loader2 className="size-5 animate-spin text-muted-foreground"/>
                                    )}
                                    {item.status === 'pending' &&
                                        <FileSpreadsheet className="size-5 text-muted-foreground"/>}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="truncate text-sm font-medium">{item.name}</p>
                                    {item.status === 'uploading' &&
                                        <p className="text-xs text-muted-foreground">正在上传...</p>}
                                    {item.status === 'success' && (
                                        <>
                                            <div className="flex gap-4 text-xs text-muted-foreground">
                                                <span>有效: <span
                                                    className="font-mono font-medium text-foreground">{item.validRows}</span></span>
                                                <span>日期: <span
                                                    className="font-mono font-medium text-foreground">{item.dateRange}</span></span>
                                            </div>
                                            {item.warnings && item.warnings.length > 0 && (
                                                <div className="rounded-sm border border-amber-200 bg-amber-50 p-2">
                                                    <p className="text-xs font-medium text-amber-800">
                                                        {item.warnings.length} 个单元格格式异常
                                                    </p>
                                                    <ul className="mt-0.5 space-y-0.5">
                                                        {item.warnings.slice(0, 3).map((w, i) => (
                                                            <li key={i} className="text-xs text-amber-700">{w}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {item.status === 'error' && item.errorMsg && (
                                        <p className="whitespace-pre-line text-xs text-red-600">{item.errorMsg}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {allDone && (
                    <div className="flex items-center gap-4">
                        {successCount > 0 && (
                            <span className="text-sm text-green-600">
                {successCount} 个文件上传成功
              </span>
                        )}
                        {errorCount > 0 && (
                            <span className="text-sm text-red-600">
                {errorCount} 个文件上传失败
              </span>
                        )}
                        <Button variant="outline" size="sm" onClick={handleReset} className="ml-auto">
                            清除记录
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default UploadZone;
