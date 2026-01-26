import React, { useEffect, useState } from 'react';

const DashboardLoading: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/30 backdrop-blur-md transition-opacity duration-500 ease-in-out animate-in fade-in">
      <div className="relative">
        <div className="absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <img src="/images/loading_panda.gif" alt="Loading..." className="w-64 h-64 relative z-10 drop-shadow-2xl" />
      </div>
      <p className="text-white text-2xl font-bold mt-6 tracking-wider animate-pulse drop-shadow-md">
        Wait...! let me finish......
      </p>
    </div>
  );
};

export default DashboardLoading;
