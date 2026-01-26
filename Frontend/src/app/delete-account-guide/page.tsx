import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import Card from '../../components/ui/card';
import { AlertTriangle, ArrowLeft, Settings } from 'lucide-react';

const DeleteAccountGuidePage = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Delete Your Account</h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        We're sorry to see you go. If you're sure you want to delete your account, please follow the steps below.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-800 dark:text-yellow-400 flex items-center mb-2">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Warning: Irreversible Action
                        </h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Deleting your account will permanently remove all your data, campaigns, and settings. This action cannot be undone.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">How to delete:</h3>
                        <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                            <li>Go to your <strong>Account Settings</strong>.</li>
                            <li>Scroll to the bottom of the page.</li>
                            <li>Click the <strong>Delete Account</strong> button.</li>
                            <li>Enter your password to confirm.</li>
                        </ol>
                    </div>
                </div>

                <div className="flex flex-col space-y-3 pt-4">
                    <Link to="/dashboard">
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Go to Dashboard
                        </Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
};

export default DeleteAccountGuidePage;
