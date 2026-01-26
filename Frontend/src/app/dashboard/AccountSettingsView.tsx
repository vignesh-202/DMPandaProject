import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Check, X, Eye, EyeOff } from 'lucide-react';

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
  if (strength === 0) return 'bg-red-500';
  if (strength === 1) return 'bg-red-400';
  if (strength === 2) return 'bg-yellow-500';
  if (strength === 3) return 'bg-blue-500';
  return 'bg-green-500';
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
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300 ease-out`}
          style={{ width: `${(strength + 1) * 20}%` }}
        />
      </div>
    </div>
  );
};

const AccountSettingsView = () => {
  const { user, hasPassword, checkAuth, logout, authenticatedFetch } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingInfo, setIsSubmittingInfo] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingSetPassword, setIsSubmittingSetPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;

    setIsDeleting(true);
    setMessage(null);

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
        setMessage({ type: 'success', text: 'Account deleted successfully. Redirecting...' });
        setTimeout(async () => {
          await logout();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete account.' });
        setIsDeleting(false); // Only stop loading on error, otherwise keep it while redirecting
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
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
    setMessage(null);

    // Explicitly check if the email has been changed
    const emailChanged = email !== user.email;

    if (emailChanged && !hasPassword) {
      setMessage({ type: 'error', text: 'Please set a password before changing your email.' });
      setShowSetPassword(true);
      return;
    }

    if (emailChanged && hasPassword && !password) {
      setMessage({ type: 'error', text: 'Please enter your password to change your email.' });
      return;
    }

    setIsSubmittingInfo(true);
    setMessage(null);

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
        setMessage({ type: 'success', text: 'Account details updated successfully!' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await checkAuth(); // Refreshes user info, including hasPassword status
        setPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update account details.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmittingInfo(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setIsSubmittingSetPassword(true);
    setMessage(null);
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
        // Check if session is still valid
        const isSessionValid = await checkAuth();

        if (isSessionValid) {
          setMessage({ type: 'success', text: 'Password set successfully!' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setShowSetPassword(false);
          setNewPassword('');
          setConfirmPassword('');
        } else {
          setMessage({ type: 'error', text: 'Session expired. Please log in again.' });
          setTimeout(async () => {
            await logout();
          }, 2000);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to set password.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmittingSetPassword(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setIsSubmittingPassword(true);
    setMessage(null);
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
        // Check if session is still valid
        const isSessionValid = await checkAuth();

        if (isSessionValid) {
          setMessage({ type: 'success', text: 'Password updated successfully!' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setNewPassword('');
          setConfirmPassword('');
        } else {
          setMessage({ type: 'error', text: 'Session expired. Please log in again.' });
          setTimeout(async () => {
            await logout();
          }, 2000);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-black dark:text-white mb-6">Account Settings</h2>

      {message && (
        <div className={`p-3 rounded-md text-sm mb-6 ${message.type === 'success'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
          {message.text}
        </div>
      )}

      <Card className="max-w-2xl">
        <form onSubmit={handleInfoSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-black dark:text-white">Full Name</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className="text-black dark:text-white" />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-black dark:text-white">Email Address</label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="text-black dark:text-white" />
          </div>

          {email !== user?.email && hasPassword && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-black dark:text-white">Confirm Password to Change Email</label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="text-black dark:text-white" />
            </div>
          )}

          <Button type="submit" disabled={isSubmittingInfo}>
            {isSubmittingInfo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </Card>

      {showSetPassword && !hasPassword && (
        <Card className="max-w-2xl mt-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Set a Password</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">You need to set a password to change your email address.</p>
          <form onSubmit={handleSetPassword} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="newPasswordSet" className="text-sm font-medium text-black dark:text-white">New Password</label>
              <div className="relative">
                <Input
                  id="newPasswordSet"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-black dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPasswordSet" className="text-sm font-medium text-black dark:text-white">Confirm New Password</label>
              <div className="relative">
                <Input
                  id="confirmPasswordSet"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-black dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {confirmPassword && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 mr-1">
                    {newPassword === confirmPassword ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button type="submit" disabled={isSubmittingSetPassword}>
              {isSubmittingSetPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Password
            </Button>
          </form>
        </Card>
      )}

      {hasPassword && (
        <Card className="max-w-2xl mt-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Change Password</h3>
          <form onSubmit={handlePasswordChangeSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="newPasswordChange" className="text-sm font-medium text-black dark:text-white">New Password</label>
              <div className="relative">
                <Input
                  id="newPasswordChange"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-black dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPasswordChange" className="text-sm font-medium text-black dark:text-white">Confirm New Password</label>
              <div className="relative">
                <Input
                  id="confirmPasswordChange"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-black dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {confirmPassword && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 mr-1">
                    {newPassword === confirmPassword ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button type="submit" disabled={isSubmittingPassword}>
              {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </form>
        </Card>
      )}

      <Card className="max-w-2xl mt-6 border-red-200 dark:border-red-900/50">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Delete Account</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Delete Account
        </Button>
      </Card>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 m-4 shadow-xl border-red-200 dark:border-red-900/50">
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Delete Account?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              This action is irreversible. Please enter your password to confirm deletion.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="deletePassword" className="text-sm font-medium text-black dark:text-white">Password</label>
                <Input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="text-black dark:text-white"
                  placeholder="Enter your password"
                />
                {message && message.type === 'error' && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">{message.text}</p>
                )}
              </div>

              <div className="flex space-x-3 justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !deletePassword}
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Delete Permanently
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AccountSettingsView;
