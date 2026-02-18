import React from 'react';

const DashboardLoading: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
      {/* Background Gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-primary/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Loading Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Panda Animation */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/15 rounded-full blur-2xl scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <img 
            src="/images/loading_panda.gif" 
            alt="Loading..." 
            className="w-56 h-56 sm:w-64 sm:h-64 relative z-10 drop-shadow-lg" 
          />
        </div>

        {/* Text */}
        <div className="text-center mt-6 space-y-2">
          <h2 className="text-foreground text-xl sm:text-2xl font-semibold tracking-tight animate-fadeIn">
            Wait...! let me finish......
          </h2>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest animate-pulse">
            Optimizing your experience
          </p>
        </div>

        {/* Loading Indicator */}
        <div className="mt-8 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};

export default DashboardLoading;
