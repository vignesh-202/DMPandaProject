import React from 'react';
import LoadingOverlay from './LoadingOverlay';

const DashboardLoading: React.FC = () => (
  <LoadingOverlay 
    variant="page-blocking" 
    message="Preparing your dashboard" 
    subMessage="Loading workspace configuration and syncing with Instagram..." 
    className="z-[200]"
  />
);

export default DashboardLoading;
