import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2 } from 'lucide-react';

const VerifyEmailPage: React.FC = () => {
  const { user, logout, authenticatedFetch } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Change Email state
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  // Delete Account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleResend = async () => {
    setIsSending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'A new verification email has been sent. Please check your inbox (and spam folder).');
      } else {
        throw new Error(data.error || 'Failed to resend verification email.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail) {
      setError('Please enter a new email address.');
      return;
    }
    setIsChangingEmail(true);
    setMessage(null);
    setError(null);
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/change-unverified-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Email changed successfully. Please check your new inbox for the verification link.');
        setShowChangeEmail(false);
        setNewEmail('');
      } else {
        throw new Error(data.error || 'Failed to change email.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setError('Please enter your password to confirm deletion.');
      return;
    }
    setIsDeleting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Account deleted successfully. Redirecting...');
        setTimeout(async () => {
          await logout();
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to delete account.');
      }
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Please Verify Your Email</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Welcome, {user?.name}! Before you can access your dashboard, you need to verify your email address.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            We've sent a verification link to <strong>{user?.email}</strong>.
          </p>
        </div>

        {message && <p className="text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 p-3 rounded-md text-center">{message}</p>}
        {error && <p className="text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md text-center">{error}</p>}

        <div className="space-y-3">
          <Button onClick={handleResend} className="w-full" disabled={isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resend Verification Email
          </Button>

          <Button variant="outline" onClick={() => { setShowChangeEmail(!showChangeEmail); setShowDeleteConfirm(false); }} className="w-full">
            {showChangeEmail ? 'Cancel' : 'Change Email Address'}
          </Button>

          {showChangeEmail && (
            <div className="space-y-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <Input
                type="email"
                placeholder="Enter new email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="text-black dark:text-white"
              />
              <Button onClick={handleChangeEmail} className="w-full" disabled={isChangingEmail}>
                {isChangingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Email
              </Button>
            </div>
          )}

          <Button variant="outline" onClick={logout} className="w-full">
            Logout
          </Button>

          <hr className="my-4 border-gray-200 dark:border-gray-600" />

          <Button
            variant="destructive"
            onClick={() => { setShowDeleteConfirm(!showDeleteConfirm); setShowChangeEmail(false); }}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {showDeleteConfirm ? 'Cancel Deletion' : 'Delete Account'}
          </Button>

          {showDeleteConfirm && (
            <div className="space-y-3 p-4 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                This action is permanent and cannot be undone. Enter your password to confirm.
              </p>
              <Input
                type="password"
                placeholder="Enter your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="text-black dark:text-white"
              />
              <Button
                onClick={handleDeleteAccount}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Permanently Delete My Account
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-center text-gray-500">
          If you don't see the email, please check your spam or junk folder.
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailPage;