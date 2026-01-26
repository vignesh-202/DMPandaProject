import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <img src="/images/loading_panda.gif" alt="Loading..." className="w-64 h-64" />
    </div>
  );
};

export default LoadingSpinner;