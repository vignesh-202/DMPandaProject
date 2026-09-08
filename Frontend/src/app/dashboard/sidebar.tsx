import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Tag,
  HelpCircle,
  Mail,
  Settings,
  MessageCircle,
  Film,
  FileText as FileTextIcon,
  Radio,
  BookText,
  AtSign,
  Landmark,
  ChevronUp,
  Plus,
  Check,
  Instagram,
  BarChart2,
  LineChart,
  Lightbulb,
  Inbox,
  Shield,
  Zap,
  FileStack,
  RefreshCw,
  Lock,
  Sparkles,
  GitBranch,
  Code,
} from 'lucide-react';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import { useDashboard, ViewType } from '../../contexts/DashboardContext';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  onItemClick?: () => void;
}

const Sidebar = ({ isCollapsed, onItemClick }: SidebarProps) => {
  const { hasLinkedInstagram } = useAuth();
  const { currentView, setCurrentView, igAccounts, setActiveAccountID, activeAccountID, activeAccount, hasUnsavedChanges, setHasUnsavedChanges, saveUnsavedChanges, discardUnsavedChanges, accessState, hasPlanFeature, planPureLimits } = useDashboard();
  const linkedAccountCount = igAccounts?.length || 0;
  const hasAnyLinkedAccount = linkedAccountCount > 0;
  const activeAccountCount = (igAccounts || []).filter(
    (account) => account?.status === 'active' && account?.effective_access !== false
  ).length;
  const hasAutomationAccountAccess = !!hasLinkedInstagram || hasAnyLinkedAccount;
  const automationLockedByBan = accessState?.automation_locked === true;
  const automationLockedBySelectedAccount = Boolean(
    activeAccount && (activeAccount.status !== 'active' || activeAccount.effective_access === false)
  );
  const selectedAccountNeedsReconnect = activeAccount?.status === 'reconnect_required' || activeAccount?.access_reason === 'reconnect_required';
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Navigation Protection State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'danger' | 'info' | 'warning' | 'success';
    onConfirm: () => void;
    onSecondary?: () => void;
    confirmLabel?: string;
    secondaryLabel?: string;
    cancelLabel?: string;
    oneButton?: boolean;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: 'info',
    onConfirm: () => { },
    oneButton: true
  });

  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigation = (viewName: ViewType) => {
    const viewFeatureMap: Partial<Record<ViewType, string>> = {
      'DM Automation': 'dm_automation',
      'Post Automation': 'post_comment_dm_reply',
      'Reel Automation': 'reel_comment_dm_reply',
      'Story Automation': 'story_automation',
      'Live Automation': 'instagram_live_automation',
      'Mentions': 'mentions',
      'Suggest More': 'suggest_more',
      'Comment Moderation': 'comment_moderation',
      'Convo Starter': 'convo_starters',
      'Inbox Menu': 'inbox_menu',
      'Welcome Message': 'welcome_message',
      'Global Trigger': 'global_trigger',
      'Super Profile': 'super_profile',
    };

    const automationFeatures: ViewType[] = [
      'Reply Templates', 'Super Profile', 'Inbox Menu', 'Convo Starter',
      'Global Trigger', 'DM Automation', 'Post Automation', 'Reel Automation',
      'Story Automation', 'Live Automation', 'Mentions',
      'Comment Moderation', 'Suggest More'
    ];
    const requiredFeature = viewFeatureMap[viewName];
    const lockedByPlan = requiredFeature ? !hasPlanFeature(requiredFeature) : false;
    const lockedByAutomationAccess = automationLockedByBan && automationFeatures.includes(viewName);

    if (currentView === viewName) return;

    // For all views with unsaved changes, show modal (portalled to center)
    if (hasUnsavedChanges) {
      setModalConfig({
        isOpen: true,
        title: 'Unsaved Changes',
        description: 'You have unsaved changes. Do you want to save them before leaving?',
        type: 'warning',
        confirmLabel: 'Save',
        secondaryLabel: 'Leave without saving',
        oneButton: false,
        cancelLabel: 'Cancel',
        onConfirm: async () => {
          setIsSavingAndLeaving(true);
          const success = await saveUnsavedChanges();
          if (success) {
            setHasUnsavedChanges(false);
            closeModal();
            setCurrentView(viewName);
            onItemClick?.();
          }
          setIsSavingAndLeaving(false);
        },
        onSecondary: () => {
          discardUnsavedChanges();
          setHasUnsavedChanges(false);
          closeModal();
          setCurrentView(viewName);
          onItemClick?.();
        }
      });
      return;
    }

    if (lockedByPlan || lockedByAutomationAccess || (automationFeatures.includes(viewName) && !hasAutomationAccountAccess)) {
      if (selectedAccountNeedsReconnect && automationFeatures.includes(viewName)) {
        setModalConfig({
          isOpen: true,
          title: 'Reconnect Instagram Required',
          description: `@${activeAccount?.username || 'This account'} needs to be linked again before automations can continue. Open account settings to reconnect this same Instagram account.`,
          type: 'warning',
          confirmLabel: 'Go to Settings',
          oneButton: false,
          secondaryLabel: 'Cancel',
          onConfirm: () => {
            closeModal();
            setCurrentView('Account Settings');
            onItemClick?.();
          }
        });
        return;
      }
      setCurrentView(viewName);
      onItemClick?.();
      return;
    }

    setCurrentView(viewName);
    onItemClick?.();
  };

  const handleAccountSwitch = (account: any) => {
    if (hasUnsavedChanges) {
      setModalConfig({
        isOpen: true,
        title: 'Discard Changes?',
        description: 'You have unsaved changes. Switching accounts will lose your progress. Continue?',
        type: 'danger',
        confirmLabel: 'Switch & Discard',
        onConfirm: () => {
          discardUnsavedChanges();
          setHasUnsavedChanges(false);
          closeModal();
          completeAccountSwitch(account);
        }
      });
      return;
    }
    completeAccountSwitch(account);
  };

  const completeAccountSwitch = (account: any) => {
    setActiveAccountID(account.ig_user_id || account.id);
    setProfileMenuOpen(false);
    onItemClick?.();
  };

  const menuSections: {
    title: string;
    items: { name: ViewType; icon: any }[];
  }[] = [
      {
        title: '',
        items: [
          { name: 'Overview', icon: LayoutDashboard },
          { name: 'Analytics', icon: BarChart2 },
          { name: 'Insights', icon: LineChart },
        ]
      },
      {
        title: 'Automation',
        items: [
          { name: 'Reply Templates', icon: FileStack },
          { name: 'Super Profile', icon: Users },
          { name: 'Welcome Message', icon: Sparkles },
          { name: 'Convo Starter', icon: MessageCircle },
          { name: 'Inbox Menu', icon: Inbox },
          { name: 'Global Trigger', icon: Zap },
          { name: 'DM Automation', icon: MessageSquare },
          { name: 'Post Automation', icon: FileTextIcon },
          { name: 'Reel Automation', icon: Film },
          { name: 'Story Automation', icon: BookText },
          { name: 'Live Automation', icon: Radio },
          { name: 'Mentions', icon: AtSign },
          { name: 'Suggest More', icon: Lightbulb },
          { name: 'Comment Moderation', icon: Shield },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'My Plan', icon: Tag },
          { name: 'Transactions', icon: Landmark },
          { name: 'Account Settings', icon: Settings },
          { name: 'Support', icon: HelpCircle },
          { name: 'Contact', icon: Mail },
        ]
      }
    ];

  const viewFeatureMap: Partial<Record<ViewType, string>> = {
    'DM Automation': 'dm_automation',
    'Post Automation': 'post_comment_dm_reply',
    'Reel Automation': 'reel_comment_dm_reply',
    'Story Automation': 'story_automation',
    'Live Automation': 'instagram_live_automation',
    'Mentions': 'mentions',
    'Suggest More': 'suggest_more',
    'Comment Moderation': 'comment_moderation',
    'Convo Starter': 'convo_starters',
    'Inbox Menu': 'inbox_menu',
    'Welcome Message': 'welcome_message',
    'Global Trigger': 'global_trigger',
    'Super Profile': 'super_profile',
  };


  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-2">
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className={cn(sectionIndex > 0 && "mt-4")}>
              {/* Section Title */}
              {!isCollapsed && section.title && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  {section.title}
                </div>
              )}

              {/* Section Items */}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.name;
                  const requiredFeature = viewFeatureMap[item.name];
                  const lockedByPlan = requiredFeature ? !hasPlanFeature(requiredFeature) : false;
                  const lockedByAutomationAccess = section.title === 'Automation' && (automationLockedByBan || automationLockedBySelectedAccount);
                  const isLocked = lockedByPlan || lockedByAutomationAccess || (section.title === 'Automation' && !hasAutomationAccountAccess);

                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.name)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 group",
                        isCollapsed && "justify-center px-2",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium",
                        !isActive && isLocked && "opacity-75"
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon className={cn(
                          "w-[18px] h-[18px] flex-shrink-0 transition-all duration-150",
                          isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground",
                          !isActive && "group-hover:scale-105",
                          isLocked && isCollapsed && "opacity-75"
                        )} />
                        {!isCollapsed && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </div>

                      {isLocked && !isCollapsed && (
                        <Lock className={cn(
                          "h-[15px] w-[15px] flex-shrink-0",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground/70"
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account Switcher - Fixed at bottom, lifted upward with modern design */}
        <div className="px-2 sm:px-3 pt-2.5 pb-3 sm:pb-4 border-t border-sidebar-border flex-shrink-0 mt-auto relative" ref={profileMenuRef}>
          {/* Flyout Menu */}
          <div className={cn(
            "absolute bottom-full mb-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-[100] transition-all duration-200",
            isCollapsed
              ? "left-full ml-3 w-64 origin-left"
              : "left-1 right-1 sm:left-2 sm:right-2",
            isProfileMenuOpen
              ? "opacity-100 translate-y-0 visible"
              : "opacity-0 translate-y-2 invisible pointer-events-none"
          )}>
            <div className="p-2.5 min-w-[200px]">
              {/* Menu Header */}
              <div className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground mb-1">
                Switch Account
              </div>

              {/* Account List - scrollable, shows ~3 accounts */}
              {igAccounts && igAccounts.length > 0 ? (
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1 px-0.5">
                  {[...igAccounts]
                    .sort((a, b) => {
                      const getVal = (acc: any) => {
                        const raw = acc.$createdAt || acc.created_at || acc.createdAt || 0;
                        const parsed = new Date(raw).getTime();
                        return Number.isNaN(parsed) ? 0 : parsed;
                      };
                      const timeA = getVal(a);
                      const timeB = getVal(b);
                      if (timeA !== timeB) return timeA - timeB;
                      return String(a.username || '').localeCompare(String(b.username || ''));
                    })
                    .map((account) => {
                    const accountKey = account.ig_user_id || account.id;
                    const isSelected = activeAccountID === accountKey;
                    const isReconnectRequired = account.status === 'reconnect_required' || account.access_reason === 'reconnect_required';
                    const isInactive = account.status !== 'active' || account.effective_access === false;
                    const isPlanLocked = account.plan_locked === true;
                    const isAdminDisabled = account.admin_status === 'inactive' || account.disabled_by_admin === true;
                    const isUserInactive = !isReconnectRequired && (account.status === 'inactive' || account.disabled_by_user === true);

                    let accountSubtitle = 'Connected';
                    if (isReconnectRequired) accountSubtitle = 'Reconnect Required';
                    else if (isAdminDisabled) accountSubtitle = 'Admin Disabled';
                    else if (isUserInactive) accountSubtitle = 'Inactive';
                    else if (account.status !== 'active') accountSubtitle = 'Inactive';
                    else if (isPlanLocked) accountSubtitle = 'Plan Locked';
                    else if (account.effective_access === false) accountSubtitle = 'Unavailable';

                    return (
                      <button
                        key={accountKey}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccountSwitch(account);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 p-2 rounded-xl transition-all duration-150 min-h-[42px]",
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground",
                          isInactive && "opacity-60",
                          isReconnectRequired && "bg-destructive/5 text-destructive"
                        )}
                      >
                        {/* Profile Picture with clean border */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={toBrowserPreviewUrl(account.profile_picture_url || '') || '/images/logo.png'}
                            alt={account.username}
                            className={cn(
                              "w-8 h-8 rounded-full object-cover border border-border",
                              isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-card"
                            )}
                          />
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                            isReconnectRequired ? "bg-destructive" : (account.status === 'active' ? "bg-emerald-500" : "bg-muted-foreground/40")
                          )} />
                        </div>

                        {/* Account Info */}
                        {!isCollapsed && (
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-xs font-medium truncate",
                                isInactive ? "text-muted-foreground" : "text-foreground"
                              )}>
                                @{account.username}
                              </p>
                              {isPlanLocked && (
                                <span className="flex-shrink-0 text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Locked
                                </span>
                              )}
                            </div>
                            <p className={cn(
                              "text-[10px] font-medium mt-0.5",
                              isReconnectRequired ? "text-destructive" : (account.status === 'active' && account.effective_access !== false ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")
                            )}>
                              {accountSubtitle}
                            </p>
                          </div>
                        )}

                        {/* Check Mark or Re-authorize */}
                        {isInactive ? (
                          <div
                            className="p-1 rounded-md hover:bg-primary/20 text-primary transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigation('Account Settings');
                              setProfileMenuOpen(false);
                            }}
                            title="Open account settings"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </div>
                        ) : isSelected ? (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No Instagram accounts linked
                </div>
              )}

              {/* Add Account Button */}
              <div className="mt-2 pt-2 border-t border-border">
                {!isCollapsed && (
                  <div className="mb-2 px-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Linked accounts</span>
                    <span className="font-medium text-foreground">{linkedAccountCount}</span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigation('Account Settings');
                    setProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-all active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {!isCollapsed && (
                    <span>Add Account</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Current Account Display */}
          <button
            onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
            className={cn(
              "w-full flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl",
              "bg-card border border-border shadow-xs",
              "hover:border-primary/40 hover:bg-muted/30",
              "transition-all duration-150 ease-out",
              "min-h-[48px]",
              "group relative",
              "active:scale-[0.98]",
              isCollapsed && "justify-center p-2 gap-0 rounded-xl min-h-0 h-10 w-10 mx-auto"
            )}
          >
            {/* Profile Picture */}
            {activeAccount ? (
              <div className="relative flex-shrink-0">
                <img
                  src={toBrowserPreviewUrl(activeAccount.profile_picture_url || '') || '/images/logo.png'}
                  alt="Profile"
                  className={cn(
                    isCollapsed ? "w-8 h-8" : "w-8 h-8 sm:w-9 sm:h-9",
                    "rounded-full object-cover border border-border",
                    "transition-all duration-150"
                  )}
                />
                {!isCollapsed && (
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full",
                    "border-2 border-card",
                    activeAccount.status === 'active' && activeAccount.admin_status !== 'inactive' && activeAccount.disabled_by_admin !== true
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/40"
                  )} />
                )}
              </div>
            ) : (
              <div className="relative flex-shrink-0">
                <div className={cn(
                  isCollapsed ? "w-8 h-8" : "w-8 h-8 sm:w-9 sm:h-9",
                  "rounded-full bg-muted flex items-center justify-center border border-border"
                )}>
                  <Instagram className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Account Info */}
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left overflow-hidden">
                  <p className="text-xs font-semibold truncate text-foreground leading-tight">
                    {activeAccount ? `@${activeAccount.username}` : 'No Account'}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5 truncate">
                    {activeAccount
                      ? ((activeAccount.admin_status === 'inactive' || activeAccount.disabled_by_admin === true)
                        ? 'Admin Disabled'
                        : activeAccount.status !== 'active'
                          ? 'Inactive'
                        : activeAccount.plan_locked === true
                            ? 'Plan Locked'
                            : activeAccount.effective_access === false
                              ? 'Unavailable'
                              : 'Connected')
                      : 'Connect now'}
                  </p>
                </div>

                <ChevronUp className={cn(
                  "w-4 h-4 flex-shrink-0 ml-1 text-muted-foreground transition-transform duration-200",
                  !isProfileMenuOpen && "rotate-180"
                )} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal - portalled to body so it centers on viewport, not sidebar */}
      {createPortal(
        <ModernConfirmModal
          isOpen={modalConfig.isOpen}
          onClose={closeModal}
          onConfirm={modalConfig.onConfirm}
          onSecondary={modalConfig.onSecondary}
          title={modalConfig.title}
          description={modalConfig.description}
          type={modalConfig.type}
          confirmLabel={modalConfig.confirmLabel}
          secondaryLabel={modalConfig.secondaryLabel}
          oneButton={modalConfig.oneButton}
          cancelLabel={modalConfig.cancelLabel}
          isLoading={isSavingAndLeaving}
        />,
        document.body
      )}
    </>
  );
};

export default Sidebar;
