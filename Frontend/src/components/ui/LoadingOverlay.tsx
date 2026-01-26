import React from 'react';
import DashboardLoading from './DashboardLoading';

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 z-50 bg-white/30 dark:bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center">
      <DashboardLoading />
      {message && <p className="text-lg mt-4 text-gray-800 dark:text-gray-200">{message}</p>}
    </div>
  );
};

export default LoadingOverlay;
