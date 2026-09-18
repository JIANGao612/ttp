import React, {useCallback, useState} from 'react';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@client/src/components/ui/tabs';
import {cn} from '@/lib/utils';
import {getMaterialTypeReport, getAgentReport} from '@client/src/api/ad-data';
import type {ReportType, AgentReportRow} from '@shared/api.interface';
import CountryDailyReport from '@client/src/pages/DataDashboard/CountryDailyReport/CountryDailyReport';
import CountryTimesReport from '@client/src/pages/DataDashboard/CountryTimesReport/CountryTimesReport';
import DashboardHeader from '../shared/DashboardHeader';
import DashboardToolbar from '../shared/DashboardToolbar';
import {useDashboard} from '../shared/DashboardContext';
import {
    ReportTable,
    MaterialTypeDailyTable,
    Td,
    MetricColumns,
    fmtDateYMD,
} from '../shared/report-tables';

const TAB_CONFIG: { value: ReportType; label: string; color: string }[] = [
    {value: 'country', label: '国家日报', color: 'data-[state=active]:bg-emerald-600 data-[state=active]:text-white'},
    {
        value: 'country-times',
        label: '国家时报',
        color: 'data-[state=active]:bg-teal-600 data-[state=active]:text-white'
    },
    {
        value: 'material-type',
        label: '素材日报',
        color: 'data-[state=active]:bg-amber-600 data-[state=active]:text-white'
    },
    {value: 'agent', label: '代理商日报', color: 'data-[state=active]:bg-cyan-600 data-[state=active]:text-white'},
];

const DAILY_HIDE_FIELDS = ['seriesNames', 'adGroupNames', 'creativeNames'];

const DailyTimes: React.FC = () => {
    const {filters} = useDashboard();
    const [activeTab, setActiveTab] = useState<ReportType>('country');

    const materialTypeFetcher = useCallback(
        (f: typeof filters) => getMaterialTypeReport(f).then(({data}) => data),
        [],
    );
    const agentFetcher = useCallback(
        (f: typeof filters) => getAgentReport(f).then(({data}) => data),
        [],
    );

    return (
        <div className="flex flex-col gap-4">
            <DashboardHeader hideFields={DAILY_HIDE_FIELDS}/>
            <div className="rounded-sm border border-border bg-card p-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
                    <TabsList className="h-9 w-full justify-center rounded-lg">
                        {TAB_CONFIG.map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={cn('flex-1 text-xs font-medium transition-colors', tab.color)}
                            >
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="country" className="mt-4">
                        <CountryDailyReport filters={filters}/>
                    </TabsContent>

                    <TabsContent value="country-times" className="mt-4">
                        <CountryTimesReport filters={filters}/>
                    </TabsContent>

                    <TabsContent value="material-type" className="mt-4">
                        <MaterialTypeDailyTable filters={filters} fetcher={materialTypeFetcher}/>
                    </TabsContent>

                    <TabsContent value="agent" className="mt-4">
                        <ReportTable<AgentReportRow>
                            filters={filters}
                            fetcher={agentFetcher}
                            defaultWidths={[120, 100, 90, 90, 80, 80, 90, 90, 90]}
                            extraHeaders={['代理商', '日期']}
                            preferenceKey="daily-times:agent"
                            renderRow={(row, widths) => (
                                <>
                                    <Td style={{width: widths[0], maxWidth: widths[0]}}>{row.agent}</Td>
                                    <Td style={{width: widths[1], maxWidth: widths[1]}}>{fmtDateYMD(row.date)}</Td>
                                    <MetricColumns row={row} startIndex={2} widths={widths}/>
                                </>
                            )}
                        />
                    </TabsContent>
                </Tabs>
            </div>
            <DashboardToolbar reportType={activeTab}/>
        </div>
    );
};

export default DailyTimes;