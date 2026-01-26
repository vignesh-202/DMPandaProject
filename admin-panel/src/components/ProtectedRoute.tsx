import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC = () => {
    const { user, loading, isAdmin, checkUser } = useAuth();

    // Optional: re-check on mount to be safe
    useEffect(() => {
        checkUser();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Enforce Admin Access
    if (!isAdmin) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                    <span className="text-4xl">🚫</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 max-w-md mb-6">
                    You do not have administrative privileges to access this dashboard.
                </p>
                <button
                    onClick={() => window.location.href = '/login'}
                    className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                    Return to Login
                </button>
            </div>
        );
    }

    return <Outlet />;
};
