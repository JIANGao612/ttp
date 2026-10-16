import React, {useState} from 'react';
import {ErrorBoundary} from 'react-error-boundary';
import UploadZone from './UploadZone';
import PairedUploadZone from './PairedUploadZone';
import UploadHistory from './UploadHistory';
import {Card, CardContent} from '@client/src/components/ui/card';
import {Clock, MoonStar, FileSpreadsheet, AlertTriangle, PackageX, Layers, Sun, Moon} from 'lucide-react';
import {logger} from '@client/src/utils/logger';
import type {UploadMode} from '@shared/api.interface';
import {AFTERNOON_SLOT, slotDisplayName} from '@shared/time-slot-schedule';

interface ModeConfig {
    label: string;
    time: string;
    filesHint: string;
    actionHint: string;
    icon: React.ComponentType<{ className?: string }>;
    willDelete: boolean;
}

const MODE_CONFIGS: Record<Exclude<UploadMode, 'paired' | 'daily_morning'>, ModeConfig> = {
    hourly_noon: {
        label: `时报 · ${slotDisplayName('12:00')}`,
        time: slotDisplayName('12:00'),
        filesHint: '上传 APAC+0 Excel（当天数据）',
        actionHint: '直接追加到数据源，不删除历史数据，同时写入一行时报记录',
        icon: Sun,
        willDelete: false,
    },
    hourly_first: {
        label: `时报 · ${slotDisplayName(AFTERNOON_SLOT)}`,
        time: slotDisplayName(AFTERNOON_SLOT),
        filesHint: '上传 APAC+0 Excel（当天数据）',
        actionHint: '先删除当天12:00的数据，再覆盖写入，同时写入一行时报记录',
        icon: Clock,
        willDelete: true,
    },
    hourly_second: {
        label: `时报 · ${slotDisplayName('22:00')}`,
        time: slotDisplayName('22:00'),
        filesHint: '上传 APAC+0 Excel（当天数据）',
        actionHint: `先删除当天${AFTERNOON_SLOT}的数据，再覆盖写入，同时写入一行时报记录`,
        icon: MoonStar,
        willDelete: true,
    },
    hourly_third: {
        label: `时报 · ${slotDisplayName('24:00')}`,
        time: slotDisplayName('24:00'),
        filesHint: '上传 APAC+0 Excel（当天数据）',
        actionHint: '先删除当天22:00的数据，再覆盖写入，同时写入一行时报记录（当天最终版）',
        icon: Moon,
        willDelete: true,
    },
    zero_cost: {
        label: '0耗素材',
        time: '周三',
        filesHint: '上传0耗素材 Excel/CSV（创意名称、消耗、创建时间）',
        actionHint: '筛选 xingbang 数据并按创意名称去重后写入关联广告数据源',
        icon: PackageX,
        willDelete: false,
    },
};

const MODE_ORDER: Exclude<UploadMode, 'paired' | 'daily_morning'>[] = ['hourly_noon', 'hourly_first', 'hourly_second', 'hourly_third', 'zero_cost'];

const getModeConfig = (mode: UploadMode | null): ModeConfig | null => {
    if (!mode) return null;
    if (mode === 'paired') return null;
    return MODE_CONFIGS[mode as Exclude<UploadMode, 'paired' | 'daily_morning'>] ?? null;
};

const DataUpload: React.FC = () => {
    const [selectedMode, setSelectedMode] = useState<UploadMode | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleUploadSuccess = () => {
        setRefreshKey((k) => k + 1);
    };

    const modeConfig = getModeConfig(selectedMode);

    return (
        <ErrorBoundary
            fallback={(
                <div className="mx-auto max-w-4xl space-y-6 p-4">
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                            <AlertTriangle className="size-10 text-amber-500"/>
                            <p className="text-sm font-medium text-foreground">页面加载出错</p>
                            <p className="text-xs text-muted-foreground">请刷新页面重试，如持续出现请联系技术支持</p>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="mt-2 rounded-sm bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
                            >
                                刷新页面
                            </button>
                        </CardContent>
                    </Card>
                </div>
            )}
            onError={(err) => logger.error(`DataUpload page error: ${String(err)}`)}
        >
            <div className="mx-auto max-w-4xl space-y-6 p-4">
                <div>
                    <h2 className="mb-3 text-sm font-semibold text-foreground">选择上传场景</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {MODE_ORDER.map((mode) => {
                            const config = MODE_CONFIGS[mode];
                            const isSelected = selectedMode === mode;
                            const Icon = config.icon;
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setSelectedMode(mode)}
                                    className={`flex items-start gap-3 rounded-sm border p-4 text-left transition-colors ${
                                        isSelected
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'border-border hover:border-primary/40 hover:bg-accent'
                                    }`}
                                >
                                    <div
                                        className={`flex size-10 shrink-0 items-center justify-center rounded-sm ${
                                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
                                        }`}
                                    >
                                        <Icon className="size-5"/>
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold">{config.label}</span>
                                            <span
                                                className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {config.time}
                    </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{config.filesHint}</p>
                                        <p
                                            className={`text-xs ${config.willDelete ? 'font-medium text-amber-600' : 'text-muted-foreground'}`}
                                        >
                                            {config.willDelete ? '⚠ ' : '✓ '}
                                            {config.actionHint}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => setSelectedMode('paired')}
                            className={`flex items-start gap-3 rounded-sm border p-4 text-left transition-colors ${
                                selectedMode === 'paired'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border hover:border-primary/40 hover:bg-accent'
                            }`}
                        >
                            <div
                                className={`flex size-10 shrink-0 items-center justify-center rounded-sm ${
                                    selectedMode === 'paired' ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
                                }`}
                            >
                                <Layers className="size-5"/>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">Promote 双文件</span>
                                    <span
                                        className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  paired
                </span>
                                </div>
                                <p className="text-xs text-muted-foreground">上传日报 +
                                    映射两份文件，按创意素材ID关联合并</p>
                                <p className="text-xs font-medium text-amber-600">⚠
                                    消耗时间先删后插，同时消耗时间备份至外部RDB</p>
                            </div>
                        </button>
                    </div>
                </div>

                {selectedMode ? (
                    selectedMode === 'paired' ? (
                        <PairedUploadZone onUploadSuccess={handleUploadSuccess}/>
                    ) : modeConfig ? (
                        <UploadZone
                            uploadMode={selectedMode}
                            modeConfig={modeConfig}
                            onUploadSuccess={handleUploadSuccess}
                        />
                    ) : (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                                <AlertTriangle className="size-6 text-amber-500"/>
                                <p className="text-sm text-muted-foreground">未识别的上传模式：{selectedMode}</p>
                            </CardContent>
                        </Card>
                    )
                ) : (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <FileSpreadsheet className="mb-3 size-10 text-muted-foreground/40"/>
                            <p className="text-sm text-muted-foreground">
                                请先选择上传场景，再进行文件上传
                            </p>
                        </CardContent>
                    </Card>
                )}

                {modeConfig?.willDelete && (
                    <div className="flex items-start gap-2 rounded-sm border border-amber-400/50 bg-amber-50 p-3">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600"/>
                        <p className="text-xs text-amber-800">
                            当前场景上传时将自动删除旧数据并备份，无需手动清空。请确认选择的场景和文件正确后再上传。
                        </p>
                    </div>
                )}

                <UploadHistory refreshKey={refreshKey}/>
            </div>
        </ErrorBoundary>
    );
};

export default DataUpload;
