import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/card';
import { createPortal } from 'react-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  Loader2,
  Check,
  X,
  EyeIcon,
  EyeOffIcon,
  Instagram,
  Link as LinkIcon,
  Trash2,
  Unlink,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  Info,
  AlertTriangle,
  Shield,
  Settings,
  User
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../../components/ui/skeleton';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';

const calculateStrength = (pwd: string) => {
  let strength = 0;
  if (pwd.length > 7) strength++;
  if (pwd.match(/[a-z]/) && pwd.match(/[A-Z]/)) strength++;
  if (pwd.match(/\d/)) strength++;
  if (pwd.match(/[^a-zA-Z\d]/)) strength++;
  return strength;
};

const getStrengthLabel = (strength: number) => {
  if (strength === 0) return 'Very Weak';
  if (strength === 1) return 'Weak';
  if (strength === 2) return 'Fair';
  if (strength === 3) return 'Good';
  return 'Strong';
};

const getStrengthColor = (strength: number) => {
  if (strength === 0) return 'bg-destructive';
  if (strength === 1) return 'bg-warning';
  if (strength === 2) return 'bg-primary';
  if (strength === 3) return 'bg-primary';
  return 'bg-success';
};

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  if (!password) return null;
  const strength = calculateStrength(password);
  const label = getStrengthLabel(strength);
  const color = getStrengthColor(strength);
  const textColor = color.replace('bg-', 'text-');

  return (
    <div className="mt-3 relative z-0 animate-fadeIn">
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-semibold ${textColor}`}>{label}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300 ease-out`}
          style={{ width: `${(strength + 1) * 20}%` }}
        />
      </div>
    </div>
  );
};

const PasswordInput = ({
  label,
  value,
  onChange,
  placeholder,
  showMatchIcon,
  isMatch,
  id,
  className
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  showMatchIcon?: boolean;
  isMatch?: boolean;
  id?: string;
  className?: string;
}) => {
  const [show, setShow] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
      <div className="relative group">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "h-12 rounded-xl pr-24 transition-all duration-300",
            "border-border",
            "focus:border-primary focus:ring-3 focus:ring-primary/15",
            showMatchIcon && value && (isMatch
              ? "border-success focus:border-success focus:ring-success/20 bg-success-muted/40"
              : "border-destructive focus:border-destructive focus:ring-destructive/20 bg-destructive-muted/40")
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {showMatchIcon && value && (
            isMatch ? (
              <Check className="h-5 w-5 text-success animate-in zoom-in duration-300" />
            ) : (
              <X className="h-5 w-5 text-destructive animate-in zoom-in duration-300" />
            )
          )}
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="p-2 text-muted-foreground hover:text-primary transition-all duration-200 bg-muted/80 rounded-xl hover:bg-muted hover:scale-105 active:scale-95"
          >
            {show ? <EyeOffIcon className="h-4 w-4" strokeWidth={2.5} /> : <EyeIcon className="h-4 w-4" strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
};

const AccountSettingsView = () => {
  const { user, hasPassword, checkAuth, logout, authenticatedFetch } = useAuth();
  const { igAccounts, setIgAccounts, fetchIgAccounts, isLoadingAccounts, setActiveAccountID, activeAccountID, planLimits, activeAccount } = useDashboard();

  // Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'instagram' | 'danger'>('profile');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingInfo, setIsSubmittingInfo] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingSetPassword, setIsSubmittingSetPassword] = useState(false);
  const instagramConnectionLimit = typeof planLimits?.instagram_connections_limit === 'number'
    ? Number(planLimits.instagram_connections_limit)
    : null;
  const canAddAnotherInstagramAccount = instagramConnectionLimit == null
    ? true
    : igAccounts.length < instagramConnectionLimit;

  // Section-specific messages
  const [sectionMessages, setSectionMessages] = useState<Record<string, { type: 'success' | 'error'; text: string } | null>>({
    global: null,
    profile: null,
    security: null,
    instagram: null,
    danger: null
  });

  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Email Change State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false);

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteModalError, setDeleteModalError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Instagram Account Management State
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [isDeletingIG, setIsDeletingIG] = useState<string | null>(null);
  const [isSyncingIG, setIsSyncingIG] = useState<string | null>(null);
  const [linkingAccountID, setLinkingAccountID] = useState<string | null>(null); // 'new' for add new, or account.id for re-auth
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<string | null>(null);
  const [showDeleteIGConfirm, setShowDeleteIGConfirm] = useState<string | null>(null);
  const [deleteIGPassword, setDeleteIGPassword] = useState('');
  const [inactiveInfoCardId, setInactiveInfoCardId] = useState<string | null>(null);
  const messageTimeoutsRef = React.useRef<number[]>([]);
  
  const sectionOverlayRoot = typeof document !== 'undefined'
    ? document.querySelector('[data-dashboard-section-overlay-root]') as HTMLElement | null
    : null;
  const sectionModalClass = sectionOverlayRoot
    ? 'pointer-events-auto absolute inset-0 z-[160] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 animate-in fade-in duration-300'
    : 'pointer-events-auto fixed inset-0 z-[160] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 animate-in fade-in duration-300';

  const resetMessages = () => {
    setSectionMessages({
      global: null,
      profile: null,
      security: null,
      instagram: null,
      danger: null
    });
  };

  const setMsg = (section: string, type: 'success' | 'error', text: string) => {
    setSectionMessages(prev => ({ ...prev, [section]: { type, text } }));
  };

  useEffect(() => {
    messageTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    messageTimeoutsRef.current = [];

    Object.entries(sectionMessages).forEach(([section, msg]) => {
      if (!msg) return;
      const timerId = window.setTimeout(() => {
        setSectionMessages((prev) => {
          if (!prev[section]) return prev;
          return { ...prev, [section]: null };
        });
      }, 4000);
      messageTimeoutsRef.current.push(timerId);
    });

    return () => {
      messageTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
      messageTimeoutsRef.current = [];
    };
  }, [sectionMessages]);

  useEffect(() => {
    const activeAccountNeedsReconnect = activeAccount?.status === 'reconnect_required' ||
      activeAccount?.access_reason === 'reconnect_required' ||
      (activeAccount?.token_expires_at && new Date(activeAccount.token_expires_at).getTime() <= Date.now());

    if (window.location.hash === '#instagram-accounts-section' || activeAccountNeedsReconnect) {
      setActiveTab('instagram');
    }
  }, [activeAccount]);

  useEffect(() => {
    if (window.location.hash === '#instagram-accounts-section') {
      setActiveTab('instagram');
    }
  }, []);

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletePassword('');
    setDeleteModalError('');
    setIsDeleting(false);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteModalError('Please enter your password.');
      return;
    }

    setIsDeleting(true);
    setDeleteModalError('');
    resetMessages();

    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setMsg('danger', 'success', 'Account deleted successfully. Redirecting...');
        setTimeout(async () => {
          await logout();
        }, 1500);
      } else {
        setDeleteModalError(data.error || 'Failed to delete account.');
        setMsg('danger', 'error', data.error || 'Failed to delete account.');
        setIsDeleting(false);
      }
    } catch (error) {
      setDeleteModalError('An error occurred. Please try again.');
      setMsg('danger', 'error', 'An error occurred. Please try again.');
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    setIsSubmittingInfo(true);

    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (response.ok) {
        setMsg('profile', 'success', 'Account details updated successfully!');
        await checkAuth();
      } else {
        setMsg('profile', 'error', data.error || 'Failed to update account details.');
      }
    } catch (error) {
      setMsg('profile', 'error', 'An error occurred. Please try again.');
    } finally {
      setIsSubmittingInfo(false);
    }
  };

  const handleEmailChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!newEmail) {
      setMsg('profile', 'error', 'New email address is required.');
      return;
    }

    if (newEmail.toLowerCase() === user?.email?.toLowerCase()) {
      setMsg('profile', 'error', 'New email address must be different from current email.');
      return;
    }

    if (hasPassword && !emailChangePassword) {
      setMsg('profile', 'error', 'Password is required to request an email change.');
      return;
    }

    setIsRequestingEmailChange(true);
    try {
      const body: { newEmail: string; password?: string } = { newEmail };
      if (hasPassword) {
        body.password = emailChangePassword;
      }

      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/request-email-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setMsg('profile', 'success', 'Verification link sent! Please check your new email to verify the change.');
        setShowEmailModal(false);
        setNewEmail('');
        setEmailChangePassword('');
      } else {
        setMsg('profile', 'error', data.error || 'Failed to request email change.');
      }
    } catch (error) {
      setMsg('profile', 'error', 'An error occurred. Please try again.');
    } finally {
      setIsRequestingEmailChange(false);
    }
  };

  const handleInstagramLink = async (accountID: string = 'new') => {
    if (accountID === 'new' && instagramConnectionLimit != null && !canAddAnotherInstagramAccount) {
      setMsg(
        'instagram',
        'error',
        `Your current plan allows ${instagramConnectionLimit} Instagram connection${instagramConnectionLimit === 1 ? '' : 's'} only. Upgrade your plan or unlink an account first.`
      );
      return;
    }

    setLinkingAccountID(accountID);
    resetMessages();
    try {
      const url = accountID !== 'new'
        ? `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/auth/instagram/url?relink=1&relink_account_id=${encodeURIComponent(accountID)}`
        : `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/auth/instagram/url`;
      const response = await authenticatedFetch(url);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMsg('instagram', 'error', data.error || 'Failed to get Instagram login URL.');
        setLinkingAccountID(null);
      }
    } catch (err) {
      setMsg('instagram', 'error', 'Failed to start Instagram login.');
      setLinkingAccountID(null);
    }
  };

  const handleAccountStatusToggle = async (accountID: string, nextStatus: 'active' | 'inactive') => {
    setIsUnlinking(accountID);
    resetMessages();
    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/ig-accounts/${accountID}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        setMsg('instagram', 'success', data.message || (nextStatus === 'active'
          ? 'Instagram account activated successfully.'
          : 'Instagram account disabled successfully.'));
        if (Array.isArray(data.ig_accounts)) {
          setIgAccounts(data.ig_accounts);
        } else {
          setIgAccounts((prev) => prev.map((account) => (
            account.id === accountID
              ? {
                  ...account,
                  status: nextStatus,
                  user_is_active: nextStatus === 'active',
                  disabled_by_user: nextStatus !== 'active',
                  is_active: nextStatus === 'active' && account.admin_status === 'active',
                  effective_access: nextStatus === 'active' && account.admin_status === 'active'
                    ? account.effective_access
                    : false,
                  access_state: nextStatus === 'active' && account.admin_status === 'active'
                    ? account.access_state
                    : 'inactive',
                  access_reason: nextStatus === 'active' && account.admin_status === 'active'
                    ? account.access_reason
                    : 'inactive'
                }
              : account
          )));
        }
      } else {
        const data = await response.json();
        setMsg('instagram', 'error', data.error || 'Failed to update account.');
      }
    } catch (err) {
      setMsg('instagram', 'error', 'An error occurred while updating account status.');
    } finally {
      setIsUnlinking(null);
    }
  };

  const handleDeleteIG = async (accountID: string, pwd?: string) => {
    if (!pwd) return;
    setIsDeletingIG(accountID);
    resetMessages();
    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/ig-accounts/${accountID}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      if (response.ok) {
        setMsg('instagram', 'success', 'Instagram account record deleted successfully.');
        setDeleteIGPassword('');
        await fetchIgAccounts();
        await checkAuth();
      } else {
        const data = await response.json();
        setMsg('instagram', 'error', data.error || 'Failed to delete account record.');
      }
    } catch (err) {
      setMsg('instagram', 'error', 'An error occurred during deletion.');
    } finally {
      setIsDeletingIG(null);
    }
  };

  const handleSyncProfile = async (accountID: string) => {
    setIsSyncingIG(accountID);
    resetMessages();
    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/ig-accounts/refresh-profiles`, {
        method: 'POST'
      });
      if (response.ok) {
        setMsg('instagram', 'success', 'Profiles refreshed successfully.');
        await fetchIgAccounts();
      } else {
        const data = await response.json().catch(() => ({}));
        setMsg('instagram', 'error', data.error || 'Failed to refresh linked Instagram profiles.');
      }
    } catch (err) {
      setMsg('instagram', 'error', 'An error occurred during profile sync.');
    } finally {
      setIsSyncingIG(null);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (newPassword !== confirmPassword) {
      setMsg('security', 'error', 'New passwords do not match.');
      return;
    }
    setIsSubmittingPassword(true);
    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        const isSessionValid = await checkAuth();
        if (isSessionValid) {
          setMsg('security', 'success', 'Password updated successfully!');
          setNewPassword('');
          setConfirmPassword('');
        } else {
          setMsg('security', 'error', 'Session expired. Please log in again.');
          setTimeout(async () => {
            await logout();
          }, 2000);
        }
      } else {
        setMsg('security', 'error', data.error || 'Failed to update password.');
      }
    } catch (error) {
      setMsg('security', 'error', 'An error occurred. Please try again.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleSetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (newPassword !== confirmPassword) {
      setMsg('global', 'error', 'Passwords do not match.');
      return;
    }
    setIsSubmittingSetPassword(true);
    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        setMsg('global', 'success', 'Password set successfully!');
        setShowSetPassword(false);
        setNewPassword('');
        setConfirmPassword('');
        await checkAuth();
      } else {
        setMsg('global', 'error', data.error || 'Failed to set password.');
      }
    } catch (error) {
      setMsg('global', 'error', 'An error occurred. Please try again.');
    } finally {
      setIsSubmittingSetPassword(false);
    }
  };

  const InlineMessage = ({ section }: { section: string }) => {
    const msg = sectionMessages[section];
    if (!msg) return null;
    return (
      <div className={cn(
        "mt-4 p-4 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300",
        msg.type === 'success'
          ? 'bg-success-muted text-success border border-success/30'
          : 'bg-destructive-muted text-destructive border border-destructive/30'
      )}>
        {msg.type === 'success' ? <Check className="h-5 w-5 shrink-0" /> : <X className="h-5 w-5 shrink-0" />}
        <span>{msg.text}</span>
      </div>
    );
  };

  if (!user || (isLoadingAccounts && igAccounts.length === 0)) {
    return (
      <LoadingOverlay
        variant="fullscreen"
        message="Loading Account Settings"
        subMessage="Fetching your profile, security details, and linked Instagram accounts..."
      />
    );
  }

  // Vertical/Horizontal Tabs List
  const tabs = [
    { id: 'profile', label: 'Profile Info', icon: User },
    { id: 'security', label: 'Security & Auth', icon: Shield },
    { id: 'instagram', label: 'Channels', icon: Instagram },
    { id: 'danger', label: 'Danger Zone', icon: Trash2 },
  ];

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto select-text animate-fadeIn">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-ig-blue via-ig-purple to-ig-pink text-white shadow-md">
              <Settings className="h-6 w-6 animate-[spin-slow_16s_linear_infinite]" />
            </span>
            Account Settings
          </h2>
          <p className="text-sm text-muted-foreground">Manage your settings, configure login credentials, and connect channels.</p>
        </div>
      </div>

      <InlineMessage section="global" />

      {/* Settings Grid Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 items-start">
        {/* Navigation Sidebar (Fully Responsive Grid/Sidebar) */}
        <div className="w-full lg:col-span-1 grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-col gap-2 p-2 bg-card/60 dark:bg-neutral-900/60 backdrop-blur-md rounded-2xl border border-border shrink-0">
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center justify-center lg:justify-start gap-2.5 px-3 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 w-full text-center lg:text-left",
                  isTabActive
                    ? tab.id === 'danger'
                      ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25"
                      : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Panels */}
        <div className="lg:col-span-4 min-w-0 w-full space-y-6">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Profile Information</h3>
                  <p className="text-xs text-muted-foreground">Manage your personal information and contact details.</p>
                </div>
              </div>

              <Card className="border border-content shadow-sm hover:shadow-md transition-shadow duration-300">
                <form onSubmit={handleInfoSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-semibold text-foreground">Full Name</label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className="h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-semibold text-foreground flex items-center justify-between">
                        <span>Email Address</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!hasPassword) {
                              setMsg('profile', 'error', 'Please set a password first before changing your email.');
                              setShowSetPassword(true);
                            } else {
                              setShowEmailModal(true);
                            }
                          }}
                          className="text-xs text-primary hover:underline font-bold"
                        >
                          Change Email
                        </button>
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="h-12 rounded-xl bg-muted/50 border-border text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmittingInfo} className="px-6 h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full sm:w-auto shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 flex items-center justify-center gap-2">
                    {isSubmittingInfo && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Save Changes</span>
                  </Button>
                  <InlineMessage section="profile" />
                </form>
              </Card>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Security & Credentials</h3>
                  <p className="text-xs text-muted-foreground">Keep your account secure by updating password credentials.</p>
                </div>
              </div>

              {hasPassword ? (
                <Card className="border border-content shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="p-4 sm:p-6">
                    <h4 className="text-base font-semibold text-foreground mb-4">Update Password</h4>
                    <form onSubmit={handlePasswordChangeSubmit} className="space-y-5 sm:space-y-6 max-w-md">
                      <PasswordInput
                        label="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <PasswordStrengthIndicator password={newPassword} />
                      <PasswordInput
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        showMatchIcon={true}
                        isMatch={confirmPassword === newPassword && confirmPassword !== ''}
                      />
                      <Button type="submit" disabled={isSubmittingPassword} className="h-12 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90 w-full sm:w-auto font-semibold shadow-md flex items-center justify-center gap-2">
                        {isSubmittingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>Change Password</span>
                      </Button>
                      <InlineMessage section="security" />
                    </form>
                  </div>
                </Card>
              ) : (
                <Card className="border border-content shadow-sm p-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <Shield className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">No Password Configured</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">You log in via OAuth. Set up a secure master password to confirm administrative changes.</p>
                  </div>
                  <Button onClick={() => setShowSetPassword(true)} className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all duration-300">
                    Set a Password
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* INSTAGRAM CHANNELS TAB */}
          {activeTab === 'instagram' && (
            <div className="space-y-4 animate-fadeIn" id="instagram-accounts-section">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Instagram className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Instagram Channels</h3>
                    <p className="text-xs text-muted-foreground">Link and manage the Instagram accounts you wish to automate.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchIgAccounts}
                  disabled={isLoadingAccounts}
                  className="rounded-xl h-10 px-4 border border-border hover:bg-muted transition-all flex items-center gap-2 group self-start sm:self-auto shadow-sm"
                >
                  <RefreshCw className={cn("h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors", isLoadingAccounts && "animate-spin text-primary")} />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">Refresh List</span>
                </Button>
              </div>

              <Card className="overflow-visible border border-content shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="p-4 sm:p-6 space-y-6">
                  {isLoadingAccounts ? (
                    <div className="grid gap-4">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-muted/40 border border-content gap-4">
                          <div className="flex items-center gap-4 w-full">
                            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-5 w-32" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                          <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : igAccounts && igAccounts.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {igAccounts.map((account) => {
                        const accountKey = account.ig_user_id || account.id;
                        const isSelected = activeAccountID === accountKey;
                        const isAdminDisabled = account.disabled_by_admin === true || account.admin_status === 'inactive';
                        const isTokenExpired = account.token_expires_at
                          ? new Date(account.token_expires_at).getTime() <= Date.now()
                          : false;
                        const isReconnectRequired = account.status === 'reconnect_required' ||
                          account.access_reason === 'reconnect_required' ||
                          isTokenExpired;
                        const isUserInactive = !isReconnectRequired && (account.disabled_by_user === true || account.status === 'inactive');
                        const isActive = account.status === 'active';
                        const statusLabel = isActive
                          ? (account.plan_locked === true ? 'Active • plan locked' : 'Active')
                          : (isAdminDisabled ? 'Inactive by admin' : 'Inactive by you');
                        const displayStatusLabel = isReconnectRequired ? 'Reconnect required' : statusLabel;

                        return (
                          <div
                            key={account.id}
                            className={cn(
                              "group relative overflow-visible rounded-2xl border p-4 transition-all duration-300 bg-card/40 backdrop-blur-sm",
                              isSelected
                                ? "border-primary/45 shadow-[0_12px_24px_-10px_rgba(131,58,180,0.15)] bg-gradient-to-br from-card to-primary/[0.02]"
                                : "border-border hover:border-primary/20",
                              !isActive && "opacity-80 bg-neutral-500/[0.02] border-dashed",
                              isReconnectRequired && "border-red-300 dark:border-red-950 bg-red-500/[0.01]"
                            )}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              {/* Left Side: Avatar + Details */}
                              <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="relative shrink-0">
                                  <div className={cn(
                                    "rounded-full p-[2px] transition-all duration-300",
                                    isActive
                                      ? "bg-gradient-to-tr from-ig-yellow via-ig-pink to-ig-purple"
                                      : "bg-slate-200 dark:bg-slate-700"
                                  )}>
                                    <img
                                      src={toBrowserPreviewUrl(account.profile_picture_url || '') || '/images/logo.png'}
                                      alt={account.username}
                                      className="h-12 w-12 rounded-full border-2 border-card object-cover shadow-sm sm:h-14 sm:w-14"
                                    />
                                  </div>
                                  <span
                                    className={cn(
                                      "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card shadow-sm",
                                      isReconnectRequired ? "bg-red-500" : (isActive ? "bg-success" : (isAdminDisabled ? "bg-destructive" : "bg-amber-400"))
                                    )}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="truncate text-sm sm:text-base font-bold text-foreground">@{account.username}</h4>
                                    {isSelected && (
                                      <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-primary">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  {account.name && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{account.name}</p>
                                  )}

                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className={cn(
                                      "inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                                      isReconnectRequired
                                        ? "border-red-400/30 bg-red-500/10 text-red-600 dark:text-red-400"
                                        : isActive
                                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : isAdminDisabled
                                          ? "border-destructive/20 bg-destructive/10 text-destructive"
                                          : "border-amber-400/20 bg-amber-400/10 text-amber-600 dark:text-amber-400"
                                    )}>
                                      {displayStatusLabel}
                                    </span>
                                    {account.plan_locked === true && (
                                      <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-600">
                                        Plan Limit Locked
                                      </span>
                                    )}
                                    {isReconnectRequired && (
                                      <span className="inline-flex items-center rounded-full border border-red-400/30 bg-red-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-red-500">
                                        <AlertTriangle className="mr-1 h-2.5 w-2.5 shrink-0" />
                                        Automations Stopped
                                      </span>
                                    )}
                                    {isAdminDisabled && (
                                      <div className="relative z-30">
                                        <button
                                          type="button"
                                          onClick={() => setInactiveInfoCardId((current) => current === account.id ? null : account.id)}
                                          onMouseEnter={() => setInactiveInfoCardId(account.id)}
                                          onMouseLeave={() => setInactiveInfoCardId((current) => current === account.id ? null : current)}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-primary"
                                          aria-label="Admin disabled support info"
                                        >
                                          <Info className="h-3 w-3" />
                                        </button>
                                        {inactiveInfoCardId === account.id && (
                                          <div className="absolute left-1/2 top-[calc(100%+0.5rem)] z-40 w-64 -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-xs font-semibold leading-relaxed text-muted-foreground shadow-xl sm:left-0 sm:translate-x-0">
                                            Contact support to solve this issue if you need this Instagram account reactivated.
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>                              {/* Right Side: Active Status Toggle + Actions */}
                              <div className="flex items-center justify-between gap-3 w-full md:w-auto md:justify-end shrink-0">
                                {isReconnectRequired ? (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleInstagramLink(account.id)}
                                    disabled={linkingAccountID === account.id}
                                    className="h-8 px-3.5 transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg flex items-center justify-center text-xs font-bold flex-1 md:flex-initial"
                                  >
                                    {linkingAccountID === account.id ? (
                                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin shrink-0" />
                                    ) : (
                                      <RefreshCw className="mr-1.5 h-3 w-3 shrink-0" />
                                    )}
                                    <span>Reconnect</span>
                                  </Button>
                                ) : (
                                  /* Active status mini switch */
                                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-muted/40 border border-border/50 shrink-0">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active:</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isAdminDisabled || isUnlinking === account.id) return;
                                        if (isActive) {
                                          setShowUnlinkConfirm(account.id);
                                          return;
                                        }
                                        void handleAccountStatusToggle(account.id, 'active');
                                      }}
                                      disabled={isAdminDisabled || isUnlinking === account.id}
                                      role="switch"
                                      aria-checked={isActive}
                                      className={cn(
                                        "relative inline-flex h-6 w-12 shrink-0 !min-h-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                        isActive ? "bg-success" : "bg-muted"
                                      )}
                                      title={isAdminDisabled ? 'Disabled by administrator.' : undefined}
                                    >
                                      <span className={cn(
                                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                        isActive ? "translate-x-6" : "translate-x-0"
                                      )} />
                                    </button>
                                  </div>
                                )}

                                <div className="flex gap-2 flex-1 md:flex-initial">
                                  {!isReconnectRequired && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setActiveAccountID(accountKey)}
                                      disabled={isSelected}
                                      className="h-8 border-border px-3 text-foreground transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary rounded-lg text-xs font-bold flex-1 md:flex-initial"
                                    >
                                      <ArrowRightLeft className="mr-1.5 h-3 w-3 shrink-0" />
                                      <span>Switch</span>
                                    </Button>
                                  )}

                                  {!isActive && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => setShowDeleteIGConfirm(account.id)}
                                      disabled={isDeletingIG === account.id}
                                      className="h-8 border-0 bg-destructive-muted/50 px-3 font-bold text-destructive hover:bg-destructive-muted rounded-lg text-xs flex-1 md:flex-initial"
                                    >
                                      {isDeletingIG === account.id ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin shrink-0" /> : <Trash2 className="mr-1.5 h-3 w-3 shrink-0" />}
                                      <span>Delete</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 space-y-4">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <Instagram className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">No Instagram accounts connected yet.</p>
                    </div>
                  )}

                  <div className="pt-6 border-t border-border">
                    <InlineMessage section="instagram" />
                    {instagramConnectionLimit != null && (
                      <p className="mt-4 text-xs font-semibold text-muted-foreground">
                        {igAccounts.length} of {instagramConnectionLimit} Instagram connections used.
                      </p>
                    )}
                    <Button
                      onClick={() => handleInstagramLink('new')}
                      disabled={linkingAccountID === 'new' || !canAddAnotherInstagramAccount}
                      className="w-full mt-4 h-12 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 rounded-xl border-0 font-semibold flex items-center justify-center gap-2.5 group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      
                      <div className="relative flex items-center justify-center gap-2.5">
                        {linkingAccountID === 'new' ? (
                          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                        ) : (
                          <>
                            <div className="relative">
                              <Instagram className="h-5 w-5 shrink-0" />
                              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white/30 rounded-full blur-sm" />
                            </div>
                            <Plus className="h-4 w-4 opacity-90 shrink-0" />
                          </>
                        )}
                        <span className="text-sm font-semibold">
                          {linkingAccountID === 'new'
                            ? 'Connecting to Instagram...'
                            : !canAddAnotherInstagramAccount
                              ? 'Instagram Limit Reached'
                              : 'Add Instagram Account'}
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* DANGER ZONE TAB */}
          {activeTab === 'danger' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-destructive">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground">Irreversible administrative actions for your account.</p>
                </div>
              </div>

              <Card className="border-2 border-destructive/20 bg-destructive/5 hover:border-destructive/30 transition-all duration-300">
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-destructive">Delete My Account</h4>
                    <p className="text-xs text-muted-foreground max-w-md">Permanently wipe your account, dashboard access, linking tokens, and all automated DM actions.</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteModal(true)}
                      className="bg-destructive hover:bg-destructive/90 h-12 px-6 rounded-xl border-0 shadow-md shadow-destructive/15 hover:shadow-lg transition-all duration-200 font-semibold"
                    >
                      Delete Account
                    </Button>
                    <InlineMessage section="danger" />
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* PORTALS & MODALS (Kept completely functional, with responsive padding) */}
      {showDeleteModal && typeof document !== 'undefined' && createPortal(
        <div className={sectionModalClass}>
          <Card className="w-full max-w-md p-5 sm:p-8 shadow-2xl border border-border bg-card rounded-3xl relative">
            <button onClick={closeDeleteModal} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-xl sm:text-2xl font-bold text-destructive mb-2 text-center">Delete Your Account?</h3>
            <div className="p-4 bg-destructive-muted/45 rounded-2xl border border-destructive/25 mb-6">
              <p className="text-sm text-destructive font-bold mb-2">Warning: Irreversible Actions</p>
              <ul className="text-xs text-destructive/80 space-y-2 text-left list-disc list-inside font-medium leading-relaxed">
                <li>All active automations will be stopped immediately.</li>
                <li>Your automation configurations, history, and analytics will be permanently erased.</li>
                <li>You will lose all access to the dashboard and its features.</li>
                <li>All linked Instagram accounts will be disconnected.</li>
              </ul>
            </div>
            <p className="text-muted-foreground mb-6 text-center text-sm font-semibold">
              Please enter your password to confirm account deletion.
            </p>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    if (deleteModalError) setDeleteModalError('');
                  }}
                  className="h-12 rounded-xl text-center text-lg border bg-muted focus:border-destructive focus:ring-2 focus:ring-destructive/20 transition-all text-black dark:text-white"
                  placeholder="Enter your password"
                  error={deleteModalError || undefined}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 rounded-xl text-lg font-bold"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !deletePassword}
                >
                  {isDeleting ? <Loader2 className="h-5 w-5 animate-spin mr-2 shrink-0" /> : null}
                  Confirm Delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="h-12 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>,
        sectionOverlayRoot || document.body
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkConfirm && typeof document !== 'undefined' && createPortal(
        <div className={sectionModalClass}>
          <Card className="w-full max-w-md p-5 sm:p-8 shadow-2xl border border-border bg-card rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-destructive"></div>
            <button onClick={() => setShowUnlinkConfirm(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-destructive-muted/40 rounded-full flex items-center justify-center">
                <Unlink className="h-8 w-8 text-destructive" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Turn Active Off?</h3>
                <div className="p-4 bg-warning-muted/40 rounded-2xl border border-warning/20">
                  <p className="text-sm text-warning font-medium">
                    Critical Consequence:
                  </p>
                  <ul className="text-xs text-warning/80 mt-2 space-y-1 text-left list-disc list-inside">
                    <li>All active automations for this account will stop immediately.</li>
                    <li>Automation sections will stay locked until you turn this account back on.</li>
                    <li>Your linked account data and analytics view will still remain available.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3 pt-4">
                <Button
                  className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 rounded-xl font-bold shadow-lg shadow-destructive/20"
                  onClick={async () => {
                    const id = showUnlinkConfirm;
                    setShowUnlinkConfirm(null);
                    await handleAccountStatusToggle(id, 'inactive');
                  }}
                  disabled={isUnlinking !== null}
                >
                  Confirm Deactivate
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowUnlinkConfirm(null)}
                  className="w-full h-12 text-muted-foreground hover:text-foreground"
                >
                  Keep Active
                </Button>
              </div>
            </div>
          </Card>
        </div>,
        sectionOverlayRoot || document.body
      )}

      {/* Permanent IG Delete Confirmation Modal */}
      {showDeleteIGConfirm && typeof document !== 'undefined' && createPortal(
        <div className={sectionModalClass}>
          <Card className="w-full max-w-md p-5 sm:p-8 shadow-2xl border border-border bg-card rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-destructive"></div>
            <button onClick={() => { setShowDeleteIGConfirm(null); setDeleteIGPassword(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-destructive-muted/40 rounded-full flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-destructive" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Delete Instagram Account?</h3>
                <div className="p-4 bg-destructive-muted/40 rounded-2xl border border-destructive/20">
                  <p className="text-sm text-destructive font-bold mb-2 text-left">
                    Irreversible Warning:
                  </p>
                  <ul className="text-xs text-destructive/80 space-y-2 text-left list-disc list-inside font-medium leading-relaxed">
                    <li>All analytics data for this account will be wiped.</li>
                    <li>Automation history and logs will be permanently deleted.</li>
                    <li>Related automation records linked to this Instagram account will be removed.</li>
                    <li>You must link this Instagram account again from scratch to use it later.</li>
                  </ul>
                </div>
              </div>

              <div className="w-full space-y-4 pt-2">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Verify with your password to continue</p>
                  <Input
                    type="password"
                    value={deleteIGPassword}
                    onChange={(e) => setDeleteIGPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-11 rounded-xl text-center"
                  />
                </div>

                <div className="flex flex-col w-full gap-3">
                  <Button
                    className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 rounded-xl font-bold shadow-lg shadow-destructive/20"
                    disabled={!deleteIGPassword || isDeletingIG !== null}
                    onClick={async () => {
                      const id = showDeleteIGConfirm;
                      const pwd = deleteIGPassword;
                      setShowDeleteIGConfirm(null);
                      await handleDeleteIG(id, pwd);
                    }}
                  >
                    Confirm Permanent Deletion
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setShowDeleteIGConfirm(null); setDeleteIGPassword(''); }}
                    className="w-full h-12 text-muted-foreground hover:text-foreground"
                  >
                    Keep Record
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>,
        sectionOverlayRoot || document.body
      )}

      {/* Set Password Modal */}
      {showSetPassword && typeof document !== 'undefined' && createPortal(
        <div className={sectionModalClass}>
          <Card className="w-full max-w-md p-5 sm:p-8 shadow-2xl border border-border bg-card rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
            <button onClick={() => { setShowSetPassword(false); setNewPassword(''); setConfirmPassword(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <LinkIcon className="h-8 w-8 text-primary" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Set a Password</h3>
                <p className="text-sm text-muted-foreground">
                  Protect your account by adding a password for sensitive changes.
                </p>
              </div>

              <form onSubmit={handleSetPasswordSubmit} className="w-full space-y-6 pt-2">
                <div className="text-left">
                  <PasswordInput
                    label="Choose Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create a strong password"
                  />
                  <PasswordStrengthIndicator password={newPassword} />
                </div>

                <div className="text-left">
                  <PasswordInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    showMatchIcon={true}
                    isMatch={confirmPassword === newPassword && confirmPassword !== ''}
                  />
                </div>

                <div className="flex flex-col w-full gap-3">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                    disabled={!confirmPassword || confirmPassword !== newPassword || isSubmittingSetPassword}
                  >
                    {isSubmittingSetPassword ? <Loader2 className="h-5 w-5 animate-spin mr-2 shrink-0" /> : null}
                    Secure My Account
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShowSetPassword(false); setNewPassword(''); setConfirmPassword(''); }}
                    className="w-full h-12 text-muted-foreground hover:text-foreground"
                  >
                    Maybe Later
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>,
        sectionOverlayRoot || document.body
      )}

      {/* Change Email Modal */}
      {showEmailModal && typeof document !== 'undefined' && createPortal(
        <div className={sectionModalClass}>
          <Card className="w-full max-w-md p-5 sm:p-8 shadow-2xl border border-border bg-card rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
            <button onClick={() => { setShowEmailModal(false); setNewEmail(''); setEmailChangePassword(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Change Email</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your new email address and password to request a secure email change.
                </p>
              </div>

              <form onSubmit={handleEmailChangeSubmit} className="w-full space-y-6 pt-2">
                <div className="text-left space-y-2">
                  <label htmlFor="newEmailInput" className="text-sm font-semibold text-foreground">New Email Address</label>
                  <Input
                    id="newEmailInput"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new-email@example.com"
                    className="h-12 rounded-xl"
                    required
                  />
                </div>

                {hasPassword && (
                  <div className="text-left">
                    <PasswordInput
                      label="Current Password"
                      id="emailChangePassword"
                      value={emailChangePassword}
                      onChange={(e) => setEmailChangePassword(e.target.value)}
                      placeholder="Enter your current password"
                    />
                  </div>
                )}

                <div className="flex flex-col w-full gap-3">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                    disabled={!newEmail || (hasPassword && !emailChangePassword) || isRequestingEmailChange}
                  >
                    {isRequestingEmailChange ? <Loader2 className="h-5 w-5 animate-spin mr-2 shrink-0" /> : null}
                    Send Verification Email
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShowEmailModal(false); setNewEmail(''); setEmailChangePassword(''); }}
                    className="w-full h-12 text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>,
        sectionOverlayRoot || document.body
      )}
    </div>
  );
};

export default AccountSettingsView;
