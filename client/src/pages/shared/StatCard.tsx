import React from 'react';
import {Card} from '@client/src/components/ui/card';
import {Skeleton} from '@client/src/components/ui/skeleton';

interface StatCardProps {
    label: string;
    value: string;
    sub?: React.ReactNode;
    loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({label, value, sub, loading}) => (
    <Card className="min-w-0 p-2.5">
    <span className="block truncate text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
        {loading ? (
            <Skeleton className="mt-1 h-5 w-16"/>
        ) : (
            <p className="mt-0.5 truncate text-lg font-bold leading-6 text-foreground tabular-nums">
                {value}
            </p>
        )}
        {!loading && sub ? (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>
        ) : null}
    </Card>
);

export default StatCard;
