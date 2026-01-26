import React, { createContext, useState, useContext, ReactNode } from 'react';

type ViewType =
  | 'Dashboard'
  | 'DM Automation'
  | 'Post Automation'
  | 'Reel Automation'
  | 'Story Automation'
  | 'Live Automation'
  | 'Global Triggers'
  | 'Mentions'
  | 'Analytics'
  | 'Transactions'
  | 'My Plan'
  | 'Account Settings'
  | 'Support'
  | 'Pricing'
  | 'Affiliate & Referral'
  | 'Watch Video'
  | 'Contact'
  | 'Have feedback?'
  | 'Automation Not working?';

interface DashboardContextProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<ViewType>('DM Automation');

  return (
    <DashboardContext.Provider value={{ currentView, setCurrentView }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};