import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import Card from '../../components/ui/card';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

const DeleteAccountGuidePage = () => {
    return (
        <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center p-4 transition-colors duration-500">
            <Card className="max-w-md w-full p-6 sm:p-8 space-y-5 sm:space-y-6 bg-white dark:bg-white/[0.04] shadow-xl border border-gray-200 dark:border-white/[0.06] rounded-2xl">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Delete Your Account</h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                        We're sorry to see you go. If you're sure you want to delete your account, please follow the steps below.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
                        <h3 className="font-semibold text-amber-900 dark:text-amber-300 flex items-center mb-2 text-sm sm:text-base">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Warning: Irreversible Action
                        </h3>
                        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-400">
                            Deleting your account will permanently remove all your data, campaigns, and settings. This action cannot be undone.
                        </p>
                    </div>

                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-white/[0.04] rounded-xl">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">How to delete:</h3>
                        <ol className="list-decimal list-inside text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <li>Go to your <strong className="text-gray-900 dark:text-gray-200">Account Settings</strong>.</li>
                            <li>Scroll to the bottom of the page.</li>
                            <li>Click the <strong className="text-gray-900 dark:text-gray-200">Delete Account</strong> button.</li>
                            <li>Enter your password to confirm.</li>
                        </ol>
                    </div>
                </div>

                <div className="flex flex-col space-y-3 pt-4">
                    <Link to="/dashboard">
                        <Button className="w-full bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 py-3 rounded-lg text-sm sm:text-lg font-medium transition-colors">
                            <ArrowLeft className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                            Return to Overview
                        </Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
};

export default DeleteAccountGuidePage;
