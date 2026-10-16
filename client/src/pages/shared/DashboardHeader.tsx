import React from 'react';
import type {AdDataFilterParams} from '@shared/api.interface';
import FilterBar from '@client/src/pages/DataDashboard/FilterBar';
import type {KeywordFieldOption} from '@client/src/components/KeywordSearchCombo';
import SummaryCards from '@client/src/pages/DataDashboard/SummaryCards';
import TrendChart from '@client/src/pages/DataDashboard/TrendChart';
import {useDashboard} from './DashboardContext';

interface DashboardHeaderProps {
    hideFields?: string[];
    showInvestDays?: boolean;
    showProductionDate?: boolean;
    showYesterdayCostMin?: boolean;
    showRenovationStatus?: boolean;
    showGroupFilter?: boolean;
    hideTrendChart?: boolean;
    primaryFields?: string[];
    idSearchPrimary?: boolean;
    orderPrimaryByList?: boolean;
    showInvestTimeReset?: boolean;
    investTimeResetTab?: string;
    investTimeResetAll?: boolean;
    filtersOverride?: AdDataFilterParams;
    onFiltersChange?: (filters: AdDataFilterParams) => void;
    keywordFieldOptions?: KeywordFieldOption[];
    showKeywordFields?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
                                                             hideFields,
                                                             showInvestDays,
                                                             showProductionDate,
                                                             showYesterdayCostMin,
                                                             showRenovationStatus,
                                                             showGroupFilter,
                                                             hideTrendChart,
                                                             primaryFields,
                                                             idSearchPrimary,
                                                             orderPrimaryByList,
                                                             showInvestTimeReset,
                                                             investTimeResetTab,
                                                             investTimeResetAll,
                                                             filtersOverride,
                                                             onFiltersChange,
                                                             keywordFieldOptions,
                                                             showKeywordFields
                                                         }) => {
    const {filters: ctxFilters, setFilters} = useDashboard();
    const filters = filtersOverride ?? ctxFilters;
    const handleChange = onFiltersChange ?? setFilters;

    const filterBar = (
        <div className="rounded-sm border border-border bg-card p-2.5">
            <FilterBar filters={filters} onChange={handleChange} onRefresh={() => handleChange({...filters})}
                       hideFields={hideFields} showInvestDays={showInvestDays} showProductionDate={showProductionDate}
                       showYesterdayCostMin={showYesterdayCostMin} showRenovationStatus={showRenovationStatus}
                       showGroupFilter={showGroupFilter} primaryFields={primaryFields} idSearchPrimary={idSearchPrimary}
                       orderPrimaryByList={orderPrimaryByList} showInvestTimeReset={showInvestTimeReset}
                       investTimeResetTab={investTimeResetTab} investTimeResetAll={investTimeResetAll}
                       keywordFieldOptions={keywordFieldOptions} showKeywordFields={showKeywordFields}/>
        </div>
    );

    if (hideTrendChart) {
        return (
            <>
                {filterBar}
                <SummaryCards filters={filters}/>
            </>
        );
    }

    return (
        <>
            <SummaryCards filters={filters}/>
            <TrendChart filters={filters}/>
            {filterBar}
        </>
    );
};

export default DashboardHeader;
