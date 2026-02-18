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
  MailPlus,
  Wallet,
  Landmark,
  ChevronUp,
  Plus,
  Check,
  Instagram,
  BarChart2,
  Lightbulb,
  Inbox,
  Shield,
  Zap,
  FileStack,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import LockedFeatureModal from '../../components/ui/LockedFeatureModal';
import { useDashboard, ViewType } from '../../contexts/DashboardContext';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  onItemClick?: () => void;
}

const Sidebar = ({ isCollapsed, onItemClick }: SidebarProps) => {
  const { user, hasLinkedInstagram } = useAuth();
  const { currentView, setCurrentView, igAccounts, setActiveAccountID, activeAccountID, activeAccount, hasUnsavedChanges, setHasUnsavedChanges, saveUnsavedChanges, discardUnsavedChanges } = useDashboard();
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isLockedModalOpen, setIsLockedModalOpen] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState("");
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
    // Check if feature requires Instagram
    const automationFeatures: ViewType[] = [
      'Reply Templates', 'Super Profile', 'Inbox Menu', 'Convo Starter',
      'Global Trigger', 'DM Automation', 'Post Automation', 'Reel Automation',
      'Story Automation', 'Live Automation', 'Mentions', 'Email Collector',
      'Comment Moderation', 'Suggest More'
    ];

    if (automationFeatures.includes(viewName) && !hasLinkedInstagram) {
      setLockedFeatureName(viewName);
      setIsLockedModalOpen(true);
      return;
    }

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
    if (account.status !== 'active') {
      setCurrentView('Account Settings');
      setProfileMenuOpen(false);
      onItemClick?.();
      return;
    }
    setActiveAccountID(account.ig_user_id);
    setProfileMenuOpen(false);
    onItemClick?.();
  };

  const handleInstagramLink = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/instagram/url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to get Instagram login URL:', data.error);
      }
    } catch (err: any) {
      console.error('Failed to start Instagram login:', err);
    }
  };

  const menuSections: {
    title: string;
    items: { name: ViewType; icon: any }[];
  }[] = [
      {
        title: '',
        items: [
          { name: 'Dashboard', icon: LayoutDashboard },
          { name: 'Analytics', icon: BarChart2 },
        ]
      },
      {
        title: 'Automation',
        items: [
          { name: 'Reply Templates', icon: FileStack },
          { name: 'Super Profile', icon: Users },
          { name: 'Inbox Menu', icon: Inbox },
          { name: 'Convo Starter', icon: MessageCircle },
          { name: 'Global Trigger', icon: Zap },
          { name: 'DM Automation', icon: MessageSquare },
          { name: 'Post Automation', icon: FileTextIcon },
          { name: 'Reel Automation', icon: Film },
          { name: 'Story Automation', icon: BookText },
          { name: 'Live Automation', icon: Radio },
          { name: 'Mentions', icon: AtSign },
          { name: 'Email Collector', icon: MailPlus },
          { name: 'Suggest More', icon: Lightbulb },
          { name: 'Comment Moderation', icon: Shield },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'My Plan', icon: Tag },
          { name: 'Transactions', icon: Landmark },
          { name: 'Affiliate & Referral', icon: Wallet },
          { name: 'Account Settings', icon: Settings },
          { name: 'Support', icon: HelpCircle },
          { name: 'Contact', icon: Mail },
        ]
      }
    ];


  return (
    <>
      <div className="flex flex-col h-full">
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className={cn(sectionIndex > 0 && "mt-4")}>
              {/* Section Title */}
              {!isCollapsed && section.title && (
                <div className="sidebar-section-title">
                  {section.title}
                </div>
              )}

              {/* Section Items */}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.name)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                        isCollapsed && "justify-center px-2",
                        isActive
                          ? "bg-gradient-to-r from-ig-purple to-ig-blue text-white shadow-lg shadow-primary/25"
                          : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                        !isActive && !hasLinkedInstagram && section.title === 'Automation' && "opacity-80"
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon className={cn(
                          "w-[18px] h-[18px] flex-shrink-0 transition-all duration-200",
                          isActive && "drop-shadow-sm",
                          !isActive && "group-hover:scale-110"
                        )} />
                        {!isCollapsed && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </div>

                      {!isCollapsed && !isActive && !hasLinkedInstagram && section.title === 'Automation' && (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account Switcher - Fixed at bottom, lifted upward with modern design */}
        <div className="px-2 sm:px-3 pt-3 pb-5 sm:pb-6 border-t border-sidebar-border flex-shrink-0 mt-auto relative mb-[33.88px]" ref={profileMenuRef}>
          {/* Flyout Menu */}
          <div className={cn(
            "absolute bottom-full left-1 right-1 sm:left-2 sm:right-2 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-[100] transition-all duration-200",
            isProfileMenuOpen
              ? "opacity-100 translate-y-0 visible"
              : "opacity-0 translate-y-2 invisible pointer-events-none"
          )}>
            <div className="p-2 pb-2.5 min-w-[200px]">
              {/* Menu Header */}
              <div className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Switch Account
              </div>

              {/* Account List */}
              {igAccounts && igAccounts.length > 0 ? (
                <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto custom-scrollbar space-y-0.5 px-1">
                  {igAccounts.map((account) => {
                    const isSelected = activeAccountID === account.ig_user_id;
                    const isInactive = account.status !== 'active';

                    return (
                      <button
                        key={account.ig_user_id || account.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccountSwitch(account);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-150 min-h-[44px]",
                          isSelected
                            ? "bg-primary/10"
                            : "hover:bg-muted",
                          isInactive && "opacity-60"
                        )}
                      >
                        {/* Profile Picture with Instagram ring */}
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "p-[2px] rounded-full",
                            isSelected
                              ? "bg-gradient-to-tr from-ig-yellow via-ig-pink to-ig-purple"
                              : "bg-border"
                          )}>
                            <img
                              src={account.profile_picture_url || '/images/logo.png'}
                              alt={account.username}
                              className="w-8 h-8 rounded-full object-cover border-2 border-card"
                            />
                          </div>
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                            account.status === 'active' ? "bg-success" : "bg-muted-foreground/40"
                          )} />
                        </div>

                        {/* Account Info */}
                        {!isCollapsed && (
                          <div className="flex-1 min-w-0 text-left">
                            <p className={cn(
                              "text-xs font-medium truncate",
                              isInactive ? "text-muted-foreground" : "text-foreground"
                            )}>
                              @{account.username}
                            </p>
                            <p className={cn(
                              "text-2xs font-medium uppercase tracking-wide",
                              account.status === 'active' ? "text-success" : "text-muted-foreground"
                            )}>
                              {account.status === 'active' ? 'Connected' : 'Re-authorize'}
                            </p>
                          </div>
                        )}

                        {/* Check Mark or Re-authorize */}
                        {isInactive ? (
                          <div
                            className="p-1.5 rounded-md hover:bg-primary/20 text-primary transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigation('Account Settings');
                              setProfileMenuOpen(false);
                            }}
                            title="Re-authorize account"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </div>
                        ) : isSelected ? (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No Instagram accounts linked
                </div>
              )}

              {/* Add Account Button - Instagram styled */}
              <div className="mt-2 pt-2 border-t border-border">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigation('Account Settings');
                    setProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  {!isCollapsed && (
                    <span className="text-xs font-semibold">Add Account</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Current Account Display - Instagram themed with gradient effects */}
          <button
            onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
            className={cn(
              "w-full flex items-center gap-2 p-2.5 sm:p-3 rounded-2xl",
              "bg-gradient-to-br from-sidebar-accent via-sidebar-accent to-sidebar-accent/90",
              "hover:from-primary/5 hover:via-ig-pink/5 hover:to-ig-yellow/5",
              "backdrop-blur-sm",
              "shadow-sm hover:shadow-lg hover:shadow-primary/10",
              "border border-sidebar-border/50 hover:border-primary/30",
              "transition-all duration-300 ease-out",
              "min-h-[52px]",
              "group relative overflow-hidden",
              "hover:scale-[1.02] active:scale-[0.98]",
              isCollapsed && "justify-center p-2.5 gap-0"
            )}
          >
            {/* Animated Instagram gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-ig-blue/0 via-primary/5 via-ig-pink/5 to-ig-yellow/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Profile Picture with Instagram story ring effect */}
            {activeAccount ? (
              <div className="relative flex-shrink-0 z-10">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-ig-yellow via-ig-pink to-ig-purple blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300 scale-125" />
                <div className={cn(
                  "p-[2px] rounded-full transition-all duration-300",
                  "bg-border group-hover:bg-gradient-to-tr group-hover:from-ig-yellow group-hover:via-ig-pink group-hover:to-ig-purple"
                )}>
                  <img
                    src={activeAccount.profile_picture_url || '/images/logo.png'}
                    alt="Profile"
                    className={cn(
                      "relative w-10 h-10 rounded-full object-cover",
                      "border-2 border-card",
                      "transition-all duration-300 ease-out",
                      "group-hover:scale-105"
                    )}
                  />
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full",
                  "border-2 border-card shadow-md",
                  "transition-all duration-300",
                  activeAccount.status === 'active'
                    ? "bg-success group-hover:shadow-success/50"
                    : "bg-muted-foreground/40"
                )} />
              </div>
            ) : (
              <div className="relative flex-shrink-0 z-10">
                <div className={cn(
                  "p-[2px] rounded-full transition-all duration-300",
                  "bg-border group-hover:bg-gradient-to-tr group-hover:from-ig-yellow group-hover:via-ig-pink group-hover:to-ig-purple"
                )}>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border-2 border-card">
                    <Instagram className="w-5 h-5 text-muted-foreground transition-colors duration-300 group-hover:text-primary" />
                  </div>
                </div>
              </div>
            )}

            {/* Account Info with smooth text transitions */}
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left z-10 overflow-hidden">
                  <p className={cn(
                    "text-xs font-semibold break-words",
                    "text-foreground group-hover:text-primary",
                    "transition-colors duration-300 ease-out",
                    "leading-tight"
                  )}>
                    {activeAccount ? `@${activeAccount.username}` : 'No Account'}
                  </p>
                  <p className={cn(
                    "text-2xs font-medium uppercase tracking-wide mt-0.5",
                    "text-muted-foreground group-hover:text-muted-foreground/80",
                    "transition-colors duration-300"
                  )}>
                    {activeAccount
                      ? (activeAccount.status === 'active' ? 'Connected' : 'Unlinked')
                      : 'Connect now'}
                  </p>
                </div>

                {/* Chevron with smooth rotation */}
                <ChevronUp className={cn(
                  "w-4 h-4 flex-shrink-0 z-10 ml-1",
                  "text-muted-foreground group-hover:text-primary",
                  "transition-all duration-300 ease-out",
                  "group-hover:scale-110",
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

      <LockedFeatureModal
        isOpen={isLockedModalOpen}
        onClose={() => setIsLockedModalOpen(false)}
        onConnect={handleInstagramLink}
        featureName={lockedFeatureName}
      />
    </>
  );
};

export default Sidebar;
