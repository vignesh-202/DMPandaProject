import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const DashboardLoading: React.FC = () => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
    <LoadingSpinner text="Preparing your dashboard..." />
  </div>
);

export default DashboardLoading;
