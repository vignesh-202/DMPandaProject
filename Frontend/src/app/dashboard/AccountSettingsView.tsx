import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { Loader2, Check, X, EyeIcon, EyeOffIcon, Instagram, Link as LinkIcon, Trash2, Unlink, Plus, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../../components/ui/skeleton';

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
    <div className="mt-3 relative z-0">
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-medium ${textColor}`}>{label}</span>
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
  const { igAccounts, fetchIgAccounts, isLoadingAccounts, setActiveAccountID, activeAccountID } = useDashboard();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingInfo, setIsSubmittingInfo] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingSetPassword, setIsSubmittingSetPassword] = useState(false);

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

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Instagram Account Management State
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [isDeletingIG, setIsDeletingIG] = useState<string | null>(null);
  const [isSyncingIG, setIsSyncingIG] = useState<string | null>(null);
  const [linkingAccountID, setLinkingAccountID] = useState<string | null>(null); // 'new' for add new, or account.id for re-auth
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<string | null>(null);
  const [showDeleteIGConfirm, setShowDeleteIGConfirm] = useState<string | null>(null);
  const [deleteIGPassword, setDeleteIGPassword] = useState('');

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

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;

    setIsDeleting(true);
    resetMessages();

    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/delete`, {
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
        setMsg('danger', 'error', data.error || 'Failed to delete account.');
        setIsDeleting(false);
      }
    } catch (error) {
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

    const emailChanged = email !== user.email;

    if (emailChanged && !hasPassword) {
      setMsg('profile', 'error', 'Please set a password before changing your email.');
      setShowSetPassword(true);
      return;
    }

    if (emailChanged && hasPassword && !password) {
      setMsg('profile', 'error', 'Please enter your password to change your email.');
      return;
    }

    setIsSubmittingInfo(true);

    try {
      const body: { name: string; email: string; password?: string } = { name, email };
      if (email !== user.email && hasPassword) {
        body.password = password;
      }

      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setMsg('profile', 'success', 'Account details updated successfully!');
        await checkAuth();
        setPassword('');
      } else {
        setMsg('profile', 'error', data.error || 'Failed to update account details.');
      }
    } catch (error) {
      setMsg('profile', 'error', 'An error occurred. Please try again.');
    } finally {
      setIsSubmittingInfo(false);
    }
  };

  const handleInstagramLink = async (accountID: string = 'new') => {
    setLinkingAccountID(accountID);
    resetMessages();
    try {
      // For unlinked accounts: try relink first (no Instagram login). If token missing/expired, use OAuth with relink=1 to avoid force_reauth.
      if (accountID !== 'new') {
        const relinkRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts/relink/${accountID}`, { method: 'POST' });
        const relinkData = await relinkRes.json().catch(() => ({}));
        if (relinkRes.ok) {
          setMsg('instagram', 'success', 'Instagram account linked successfully.');
          await fetchIgAccounts();
          await checkAuth();
          setLinkingAccountID(null);
          return;
        }
        // Fall through to OAuth with relink=1 (force_reauth=false) so user may not need to log in to Instagram again
      }

      const url = accountID !== 'new'
        ? `${import.meta.env.VITE_API_BASE_URL}/api/auth/instagram/url?relink=1`
        : `${import.meta.env.VITE_API_BASE_URL}/api/auth/instagram/url`;
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

  const handleUnlinkIG = async (accountID: string) => {
    setIsUnlinking(accountID);
    resetMessages();
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts/${accountID}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setMsg('instagram', 'success', 'Instagram account unlinked successfully.');
        await fetchIgAccounts();
        await checkAuth();
      } else {
        const data = await response.json();
        setMsg('instagram', 'error', data.error || 'Failed to unlink account.');
      }
    } catch (err) {
      setMsg('instagram', 'error', 'An error occurred during unlinking.');
    } finally {
      setIsUnlinking(null);
    }
  };

  const handleDeleteIG = async (accountID: string, pwd?: string) => {
    if (!pwd) return;
    setIsDeletingIG(accountID);
    resetMessages();
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts/${accountID}`, {
        method: 'DELETE',
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
      // Step 1: Fetch latest stats (which includes profile pic & username)
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/stats?account_id=${accountID}`);
      if (response.ok) {
        const data = await response.json();

        // Step 2: Update database with latest data
        const updateResp = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts/sync-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: accountID,
            profile_picture_url: data.profile_picture_url,
            username: data.username
          })
        });

        if (updateResp.ok) {
          setMsg('instagram', 'success', 'Profile synced successfully!');
          await fetchIgAccounts();
        } else {
          setMsg('instagram', 'error', 'Failed to update profile data in database.');
        }
      } else {
        const data = await response.json();
        setMsg('instagram', 'error', data.error || 'Failed to fetch latest profile data.');
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
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/change-password`, {
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
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        // If backend rotated the session token, persist it so the user stays logged in
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
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
      <div className={`mt-4 p-4 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${msg.type === 'success'
        ? 'bg-success-muted text-success border border-success/30'
        : 'bg-destructive-muted text-destructive border border-destructive/30'
        }`}>
        {msg.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
        {msg.text}
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 sm:space-y-8 lg:space-y-10 max-w-4xl mx-auto select-text">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Account Settings</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Manage your profile, security, and connected accounts.</p>
      </div>

      <InlineMessage section="global" />

      {/* Profile Info */}
      <section className="space-y-3 sm:space-y-4">
        <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <span className="w-1 h-6 bg-primary rounded-full"></span>
          Profile Information
        </h3>
        <Card className="max-w-none border border-content shadow-md hover:shadow-lg transition-shadow duration-300">
          <form onSubmit={handleInfoSubmit} className="p-5 sm:p-6 space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-semibold text-foreground">Full Name</label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-foreground">Email Address</label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="h-12 rounded-xl" />
              </div>
            </div>

            {email !== user?.email && hasPassword && (
              <PasswordInput
                label="Confirm Password to Change Email"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="max-w-md"
              />
            )}

            <Button type="submit" disabled={isSubmittingInfo} className="px-6 sm:px-8 h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full sm:w-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
              {isSubmittingInfo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            <InlineMessage section="profile" />
          </form>
        </Card>
      </section>

      {/* Security Section */}
      <section className="space-y-3 sm:space-y-4">
        <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <span className="w-1 h-6 bg-primary rounded-full"></span>
          Security
        </h3>
        {hasPassword ? (
          <Card className="max-w-none border border-content shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="p-5 sm:p-6">
              <h4 className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-5">Update Password</h4>
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
                <Button type="submit" disabled={isSubmittingPassword} className="h-12 px-6 sm:px-8 rounded-xl bg-foreground text-background hover:bg-foreground/90 w-full sm:w-auto font-semibold">
                  {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
                <InlineMessage section="security" />
              </form>
            </div>
          </Card>
        ) : (
          <Card className="max-w-none border border-content shadow-md">
            <div className="p-5 sm:p-6 text-center space-y-4">
              <p className="text-sm sm:text-base text-muted-foreground">You haven't set a password yet.</p>
              <Button onClick={() => setShowSetPassword(true)} className="h-12 px-6 sm:px-8 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90">Set a Password</Button>
            </div>
          </Card>
        )}
      </section>

      {/* Instagram Accounts Section */}
      <section className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <span className="w-1 h-6 bg-primary rounded-full"></span>
            <Instagram className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Linked Instagram Accounts
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIgAccounts}
            disabled={isLoadingAccounts}
            className="rounded-xl h-9 px-3 sm:px-4 border border-border hover:bg-muted transition-all flex items-center gap-2 group self-start sm:self-auto"
          >
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors", isLoadingAccounts && "animate-spin text-primary")} />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">Refresh</span>
          </Button>
        </div>
        <Card className="overflow-hidden border border-content shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="p-5 sm:p-6 space-y-5 sm:space-y-6">
            {isLoadingAccounts ? (
              <div className="grid gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 lg:p-5 rounded-2xl bg-muted/50 border border-content gap-4">
                    <div className="flex items-center gap-4 w-full">
                      <Skeleton className="w-14 h-14 rounded-full shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-11 w-28 rounded-xl shrink-0" />
                  </div>
                ))}
              </div>
            ) : igAccounts && igAccounts.length > 0 ? (
              <div className="grid gap-4">
                {igAccounts.map((account) => (
                  <div key={account.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 lg:p-5 rounded-2xl bg-muted/30 border border-content hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 gap-4 md:gap-6">
                    <div className="flex items-center gap-4 w-full">
                      {/* Instagram Story Ring Effect */}
                      <div className="relative shrink-0">
                        <div className={cn(
                          "p-[2.5px] rounded-full transition-all duration-300",
                          account.status === 'active' 
                            ? "bg-gradient-to-tr from-ig-yellow via-ig-pink to-ig-purple" 
                            : "bg-muted"
                        )}>
                          <img
                            src={account.profile_picture_url || '/images/logo.png'}
                            alt={account.username}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-card shadow-md object-cover"
                          />
                        </div>
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card shadow-sm",
                          account.status === 'active' ? 'bg-success' : 'bg-muted-foreground/60'
                        )}></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-foreground text-base sm:text-lg truncate">@{account.username}</h4>
                        <p className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Status: <span className={account.status === 'active' ? 'text-success' : 'text-muted-foreground'}>
                            {account.status}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      {account.status === 'active' ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setShowUnlinkConfirm(account.id)}
                            disabled={isUnlinking === account.id || showUnlinkConfirm === account.id}
                            className="flex-1 sm:flex-none h-11 border-border hover:bg-destructive-muted/40 hover:text-destructive hover:border-destructive/40 text-foreground rounded-xl px-4 transition-all duration-200"
                          >
                            {isUnlinking === account.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                            <span className="text-sm font-semibold">Unlink</span>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setActiveAccountID(account.ig_user_id)}
                            disabled={activeAccountID === account.ig_user_id}
                            className="flex-1 sm:flex-none h-11 border-border hover:bg-primary/10 hover:text-primary hover:border-primary/50 text-foreground rounded-xl px-4 transition-all duration-200"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            <span className="text-sm font-semibold">Switch</span>
                          </Button>
                        </>
                      ) : (
                        <div className="flex gap-2 w-full">
                          {/* unlinked: show Link to connect again; invalid (token expired): show Re-authorize */}
                          {account.status === 'unlinked' ? (
                            <Button
                              onClick={() => handleInstagramLink(account.id)}
                              disabled={linkingAccountID === account.id}
                              className="flex-1 sm:flex-none h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all duration-300 rounded-xl px-4"
                            >
                              {linkingAccountID === account.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                              <span className="text-sm font-semibold whitespace-nowrap">Link</span>
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleInstagramLink(account.id)}
                              disabled={linkingAccountID === account.id}
                              className="flex-1 sm:flex-none h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all duration-300 rounded-xl px-4"
                            >
                              {linkingAccountID === account.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                              <span className="text-sm font-semibold whitespace-nowrap">Re-authorize</span>
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            onClick={() => setShowDeleteIGConfirm(account.id)}
                            disabled={isDeletingIG === account.id}
                            className="flex-1 sm:flex-none h-10 sm:h-11 bg-destructive-muted/50 text-destructive hover:bg-destructive-muted border-0 rounded-xl font-bold px-4"
                          >
                            {isDeletingIG === account.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            <span className="text-sm">Delete</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Instagram className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No Instagram accounts linked yet.</p>
              </div>
            )}

            <div className="pt-6 border-t border-border">
              <InlineMessage section="instagram" />
              <Button
                onClick={() => handleInstagramLink('new')}
                disabled={linkingAccountID === 'new'}
                className="w-full mt-4 h-12 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 rounded-xl border-0 font-semibold flex items-center justify-center gap-2.5 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                <div className="relative flex items-center justify-center gap-2.5">
                  {linkingAccountID === 'new' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <div className="relative">
                        <Instagram className="h-5 w-5" />
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white/30 rounded-full blur-sm" />
                      </div>
                      <Plus className="h-4 w-4 opacity-90" />
                    </>
                  )}
                  <span className="text-sm font-semibold">
                    {linkingAccountID === 'new' ? 'Connecting to Instagram...' : 'Add Instagram Account'}
                  </span>
                </div>
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-destructive flex items-center gap-2">
          <span className="w-1 h-6 bg-destructive rounded-full"></span>
          Danger Zone
        </h3>
        <Card className="border-2 border-destructive/30 bg-destructive-muted/30">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-destructive">Delete Account</h4>
              <p className="text-sm text-destructive/80">Permanently delete your account and all its data.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteModal(true)}
                className="bg-destructive hover:bg-destructive/90 h-12 px-8 rounded-xl border-0 shadow-md shadow-destructive/20 hover:shadow-lg hover:shadow-destructive/30 transition-all duration-200"
              >
                Delete Account
              </Button>
              <InlineMessage section="danger" />
            </div>
          </div>
        </Card>
      </section>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-md p-8 shadow-2xl border border-border bg-card rounded-3xl relative">
            <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-2xl font-bold text-destructive mb-2 text-center">Delete Your Account?</h3>
            <div className="p-4 bg-destructive-muted/40 rounded-2xl border border-destructive/20 mb-6">
              <p className="text-sm text-destructive font-bold mb-2">Warning: Irreversible Actions</p>
              <ul className="text-xs text-destructive/80 space-y-2 text-left list-disc list-inside font-medium leading-relaxed">
                <li>All active automations will be stopped immediately.</li>
                <li>Your automation configurations, history, and analytics will be permanently erased.</li>
                <li>You will lose all access to the DM Panda dashboard and features.</li>
                <li>All linked Instagram accounts will be disconnected.</li>
              </ul>
            </div>
            <p className="text-muted-foreground mb-6 text-center text-sm">
              Please enter your password to confirm account deletion.
            </p>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="h-12 rounded-xl text-center text-lg"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 rounded-xl text-lg font-bold"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !deletePassword}
                >
                  {isDeleting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Confirm Delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                  }}
                  disabled={isDeleting}
                  className="h-12 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-md p-8 shadow-2xl border border-border bg-card rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-destructive"></div>
            <button onClick={() => setShowUnlinkConfirm(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-destructive-muted/40 rounded-full flex items-center justify-center">
                <Unlink className="h-8 w-8 text-destructive" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Unlink Account?</h3>
                <div className="p-4 bg-warning-muted/40 rounded-2xl border border-warning/20">
                  <p className="text-sm text-warning font-medium">
                    Critical Consequence:
                  </p>
                  <ul className="text-xs text-warning/80 mt-2 space-y-1 text-left list-disc list-inside">
                    <li>All active automations for this account will stop immediately.</li>
                    <li>You will lose access to DM, Post, Reel, and Story automation sections.</li>
                    <li>Analytics and inbox sync will be paused.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3 pt-4">
                <Button
                  className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 rounded-xl font-bold shadow-lg shadow-destructive/20"
                  onClick={async () => {
                    const id = showUnlinkConfirm;
                    setShowUnlinkConfirm(null);
                    await handleUnlinkIG(id);
                  }}
                  disabled={isUnlinking !== null}
                >
                  Confirm Unlink
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowUnlinkConfirm(null)}
                  className="w-full h-12 text-muted-foreground hover:text-foreground"
                >
                  Keep Account Linked
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* Permanent IG Delete Confirmation Modal */}
      {showDeleteIGConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-md p-8 shadow-2xl border border-border bg-card rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-destructive"></div>
            <button onClick={() => { setShowDeleteIGConfirm(null); setDeleteIGPassword(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-destructive-muted/40 rounded-full flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-destructive" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Delete Data Record?</h3>
                <div className="p-4 bg-destructive-muted/40 rounded-2xl border border-destructive/20">
                  <p className="text-sm text-destructive font-bold mb-2 text-left">
                    Irreversible Warning:
                  </p>
                  <ul className="text-xs text-destructive/80 space-y-2 text-left list-disc list-inside font-medium leading-relaxed">
                    <li>ALL analytics data for this account will be wiped.</li>
                    <li>Automation history and logs will be permanently deleted.</li>
                    <li>Subscription links (if any) will be disconnected.</li>
                    <li>You must re-link from scratch to ever use this account again.</li>
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
        </div>
      )}
      {/* Set Password Modal */}
      {showSetPassword && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-md p-8 shadow-2xl border border-border bg-card rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
            <button onClick={() => { setShowSetPassword(false); setNewPassword(''); setConfirmPassword(''); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <LinkIcon className="h-8 w-8 text-primary" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Set a Password</h3>
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
                    {isSubmittingSetPassword ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
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
        </div>
      )}
    </div>
  );
};

export default AccountSettingsView;


