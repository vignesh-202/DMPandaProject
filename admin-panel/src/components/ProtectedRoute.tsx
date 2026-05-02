import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminLoadingState from './AdminLoadingState';

export const ProtectedRoute: React.FC = () => {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return <AdminLoadingState fullScreen title="Checking admin session" description="Verifying your access and preparing the dashboard workspace." />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!isAdmin) {
        return (
            <div className="flex min-h-screen items-center justify-center px-6">
                <div className="glass-card ig-topline w-full max-w-lg rounded-[32px] p-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <div className="h-4 w-4 rounded-full bg-destructive" />
                    </div>
                    <p className="mt-6 text-[10px] font-black text-muted-foreground">
                        Restricted
                    </p>
                    <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-foreground">Access Denied</h1>
                    <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                        Your account is signed in, but it does not have administrative privileges for this workspace.
                    </p>
                    <button
                        onClick={() => window.location.href = '/login'}
                        className="btn-primary mt-8 w-full px-6 py-3 text-xs"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return <Outlet />;
};
