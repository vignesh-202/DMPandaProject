import React from 'react';
import { Instagram, AlertCircle, ChevronRight, Settings, Plus } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { Button } from '../ui/button';

const AccountBarrier: React.FC = () => {
  const { activeAccount, setCurrentView } = useDashboard();

  const isUnlinked = activeAccount && activeAccount.status !== 'active';
  const isAccessLocked = activeAccount && activeAccount.status === 'active' && activeAccount.effective_access === false;
  const title = isUnlinked
    ? 'Account Re-authorization Required'
    : isAccessLocked
      ? 'Account Access Restricted'
      : 'No Instagram Account Linked';
  const description = isUnlinked
    ? `Your link with @${activeAccount.username} has expired or been disconnected. Re-authorize now to continue using our automation suite.`
    : isAccessLocked
      ? (activeAccount.access_state === 'plan_locked'
        ? `@${activeAccount.username} is still linked, but your current plan does not cover this account right now. You can manage or unlink it in Account Settings.`
        : `@${activeAccount.username} is linked, but automation access is disabled for this account. You can review the status in Account Settings.`)
      : 'To access our powerful automation tools and analytics, you need to link your Instagram professional account first.';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fadeIn">
      {/* Icon Section */}
      <div className="relative mb-8">
        <div className="p-[2px] rounded-2xl bg-ig-gradient shadow-ig-glow">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-card rounded-2xl flex items-center justify-center border border-border">
            <Instagram className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground" />
          </div>
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 bg-destructive rounded-xl flex items-center justify-center border-4 border-background shadow-lg shadow-destructive/30">
          <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive-foreground" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 tracking-tight">
        {title}
      </h2>

      {/* Description */}
      <p className="max-w-md text-muted-foreground mb-10 leading-relaxed">
        {description}
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
