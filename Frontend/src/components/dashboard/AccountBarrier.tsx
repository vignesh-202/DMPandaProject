import React from 'react';
import { Instagram, AlertCircle, ChevronRight, Settings, Plus } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { Button } from '../ui/button';

const AccountBarrier: React.FC = () => {
  const { activeAccount, setCurrentView } = useDashboard();

  const isUnlinked = activeAccount && activeAccount.status !== 'active';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fadeIn">
      {/* Icon Section */}
      <div className="relative mb-8">
        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-muted rounded-2xl flex items-center justify-center shadow-lg border border-border">
          <Instagram className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 bg-destructive rounded-xl flex items-center justify-center border-4 border-background shadow-lg shadow-destructive/30">
          <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive-foreground" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 tracking-tight">
        {isUnlinked ? 'Account Re-authorization Required' : 'No Instagram Account Linked'}
      </h2>

      {/* Description */}
      <p className="max-w-md text-muted-foreground mb-10 leading-relaxed">
        {isUnlinked
          ? `Your link with @${activeAccount.username} has expired or been disconnected. Re-authorize now to continue using our automation suite.`
          : 'To access our powerful automation tools and analytics, you need to link your Instagram professional account first.'}
      </p>

      {/* Action Button */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Button
          onClick={() => setCurrentView('Account Settings')}
          size="lg"
          className="flex-1"
          leftIcon={isUnlinked ? <Settings className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          {isUnlinked ? 'Go to Settings' : 'Link Account'}
        </Button>
      </div>

      {/* Footer Note */}
      <p className="mt-8 text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        Secure connection via Meta API v21.0
      </p>
    </div>
  );
};

export default AccountBarrier;
