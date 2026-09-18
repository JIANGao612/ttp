import React, {useState, useEffect, useCallback} from 'react';
import {Settings2, Check, Plus, Trash2, Star, StarOff} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Popover, PopoverContent, PopoverTrigger} from '@client/src/components/ui/popover';
import {Input} from '@client/src/components/ui/input';
import {userPreferences} from '@client/src/api/user-preferences';
import {logger} from '@client/src/utils/logger';

export interface ColumnItem {
    key: string;
    label: string;
}

interface ColumnPresetManagerProps {
    preferenceKey: string;
    columns: ColumnItem[];
    visibleKeys: string[];
    onChange: (visibleKeys: string[]) => void;
    title?: string;
    buttonLabel?: string;
}

interface PresetConfig {
    presets: Array<{ name: string; visibleKeys: string[]; isDefault?: boolean }>;
    currentPreset?: string;
}

const EMPTY_CONFIG: PresetConfig = {presets: []};

function loadConfig(raw: string | null): PresetConfig {
    if (!raw) return {...EMPTY_CONFIG};
    try {
        const parsed = JSON.parse(raw) as PresetConfig;
        if (!parsed?.presets || !Array.isArray(parsed.presets)) return {...EMPTY_CONFIG};
        return parsed;
    } catch {
        return {...EMPTY_CONFIG};
    }
}

const ColumnPresetManager: React.FC<ColumnPresetManagerProps> = ({
                                                                     preferenceKey,
                                                                     columns,
                                                                     visibleKeys,
                                                                     onChange,
                                                                     title = '列设置',
                                                                     buttonLabel = '列设置',
                                                                 }) => {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<PresetConfig>(EMPTY_CONFIG);
    const [saving, setSaving] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        userPreferences.getUserPreference(preferenceKey)
            .then((pref) => {
                if (cancelled) return;
                const cfg = loadConfig(pref?.value ?? null);
                setConfig(cfg);
                const defaultPreset = cfg.presets.find((p) => p.isDefault);
                if (defaultPreset && defaultPreset.visibleKeys.length > 0) {
                    onChange(defaultPreset.visibleKeys);
                }
            })
            .catch((err) => logger.error('加载列预设失败', err))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [preferenceKey, onChange]);

    const hiddenCount = columns.length - visibleKeys.length;

    const isVisible = useCallback(
        (key: string) => visibleKeys.includes(key),
        [visibleKeys],
    );

    const toggleColumn = useCallback(
        (key: string) => {
            if (isVisible(key)) {
                onChange(visibleKeys.filter((k: string) => k !== key));
            } else {
                onChange([...visibleKeys, key]);
            }
        },
        [isVisible, visibleKeys, onChange],
    );

    const showAll = useCallback(() => {
        onChange(columns.map((c: ColumnItem) => c.key));
    }, [columns, onChange]);

    const applyPreset = useCallback(
        (name: string) => {
            const preset = config.presets.find((p) => p.name === name);
            if (preset) {
                onChange(preset.visibleKeys);
            }
        },
        [config.presets, onChange],
    );

    const saveAsPreset = useCallback(async () => {
        const name = newPresetName.trim();
        if (!name) return;
        setSaving(true);
        try {
            const newPresets = config.presets.filter((p) => p.name !== name);
            const hasExistingDefault = config.presets.some((p) => p.isDefault);
            newPresets.push({
                name,
                visibleKeys: [...visibleKeys],
                isDefault: !hasExistingDefault,
            });
            const nextConfig: PresetConfig = {presets: newPresets, currentPreset: name};
            await userPreferences.setUserPreference(preferenceKey, JSON.stringify(nextConfig));
            setConfig(nextConfig);
            setNewPresetName('');
            setShowSaveForm(false);
        } catch (err) {
            logger.error('保存预设失败', err);
        } finally {
            setSaving(false);
        }
    }, [config.presets, newPresetName, preferenceKey, visibleKeys]);

    const deletePreset = useCallback(
        async (name: string) => {
            const nextPresets = config.presets.filter((p) => p.name !== name);
            const nextConfig: PresetConfig = {presets: nextPresets};
            try {
                await userPreferences.setUserPreference(preferenceKey, JSON.stringify(nextConfig));
                setConfig(nextConfig);
            } catch (err) {
                logger.error('删除预设失败', err);
            }
        },
        [config.presets, preferenceKey],
    );

    const setDefaultPreset = useCallback(
        async (name: string) => {
            const nextPresets = config.presets.map((p) => ({
                ...p,
                isDefault: p.name === name,
            }));
            const nextConfig: PresetConfig = {presets: nextPresets, currentPreset: config.currentPreset};
            try {
                await userPreferences.setUserPreference(preferenceKey, JSON.stringify(nextConfig));
                setConfig(nextConfig);
            } catch (err) {
                logger.error('设置默认预设失败', err);
            }
        },
        [config.presets, config.currentPreset, preferenceKey],
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Settings2 className="size-3"/>
                    {buttonLabel}
                    {hiddenCount > 0 && (
                        <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {hiddenCount}隐藏
            </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-xs font-medium">{title}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={showAll}>
                        全部显示
                    </Button>
                </div>

                {config.presets.length > 0 && (
                    <div className="border-b px-2 py-1.5">
                        <div className="px-1 pb-1 text-[10px] text-muted-foreground">我的预设</div>
                        {config.presets.map((preset) => (
                            <div
                                key={preset.name}
                                className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-muted/50"
                            >
                                <button
                                    type="button"
                                    className="flex-1 truncate text-left text-xs"
                                    onClick={() => applyPreset(preset.name)}
                                >
                                    {preset.name}
                                    {preset.isDefault && (
                                        <span className="ml-1 text-[10px] text-primary">默认</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className="rounded p-1 hover:bg-muted"
                                    onClick={() => setDefaultPreset(preset.name)}
                                    title={preset.isDefault ? '取消默认' : '设为默认'}
                                >
                                    {preset.isDefault ? (
                                        <Star className="size-3 text-primary"/>
                                    ) : (
                                        <StarOff className="size-3 text-muted-foreground"/>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className="rounded p-1 hover:bg-destructive/10"
                                    onClick={() => deletePreset(preset.name)}
                                    title="删除预设"
                                >
                                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive"/>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="max-h-64 overflow-y-auto py-1">
                    {loading ? (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">加载中...</div>
                    ) : (
                        columns.map((col: ColumnItem) => (
                            <div
                                key={col.key}
                                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/50"
                                onClick={() => toggleColumn(col.key)}
                            >
                                <div className="flex h-4 w-4 items-center justify-center rounded border border-input">
                                    {isVisible(col.key) && <Check className="size-3"/>}
                                </div>
                                <span className="truncate text-xs">{col.label}</span>
                            </div>
                        ))
                    )}
                </div>

                {showSaveForm ? (
                    <div className="flex items-center gap-2 border-t p-2">
                        <Input
                            className="h-7 flex-1 text-xs"
                            placeholder="预设名称"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveAsPreset();
                            }}
                        />
                        <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={saving || !newPresetName.trim()}
                            onClick={() => void saveAsPreset()}
                        >
                            保存
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                                setShowSaveForm(false);
                                setNewPresetName('');
                            }}
                        >
                            取消
                        </Button>
                    </div>
                ) : (
                    <div className="border-t p-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs gap-1"
                            onClick={() => setShowSaveForm(true)}
                        >
                            <Plus className="size-3"/>
                            另存为预设
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default ColumnPresetManager;
