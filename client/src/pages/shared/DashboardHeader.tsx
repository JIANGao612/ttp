import React from 'react';
import FilterBar from '@client/src/pages/DataDashboard/FilterBar';
import SummaryCards from '@client/src/pages/DataDashboard/SummaryCards';
import TrendChart from '@client/src/pages/DataDashboard/TrendChart';
import {useDashboard} from './DashboardContext';

interface DashboardHeaderProps {
    hideFields?: string[];
    showInvestDays?: boolean;
    showProductionDate?: boolean;
    showYesterdayCostMin?: boolean;
    showRenovationStatus?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
                                                             hideFields,
                                                             showInvestDays,
                                                             showProductionDate,
                                                             showYesterdayCostMin,
                                                             showRenovationStatus
                                                         }) => {
    const {filters, setFilters} = useDashboard();

    return (
        <>
            <div className="rounded-sm border border-border bg-card p-4">
                <FilterBar filters={filters} onChange={setFilters} onRefresh={() => setFilters({...filters})}
                           hideFields={hideFields} showInvestDays={showInvestDays}
                           showProductionDate={showProductionDate} showYesterdayCostMin={showYesterdayCostMin}
                           showRenovationStatus={showRenovationStatus}/>
            </div>
            <SummaryCards filters={filters}/>
            <TrendChart filters={filters}/>
        </>
    );
};

export default DashboardHeader;
