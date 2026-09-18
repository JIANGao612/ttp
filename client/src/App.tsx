import React from 'react';
import {BrowserRouter, Route, Routes} from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import {DashboardProvider} from './pages/shared/DashboardContext';
import DataSource from './pages/DataSource/DataSource';
import DailyTimes from './pages/DailyTimes/DailyTimes';

const RoutesComponent = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout/>}>
                    <Route element={<DashboardProvider/>}>
                        <Route index element={<DataSource/>}/>
                        <Route path="daily-times" element={<DailyTimes/>}/>
                    </Route>
                </Route>
                <Route path="*" element={<NotFound/>}/>
            </Routes>
        </BrowserRouter>
    );
};

export default RoutesComponent;