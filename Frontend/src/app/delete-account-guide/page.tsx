import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import Card from '../../components/ui/card';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

const DeleteAccountGuidePage = () => {
    useEffect(() => {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 space-y-6 bg-white shadow-xl border border-gray-100 rounded-2xl">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Delete Your Account</h1>
                    <p className="text-gray-500">
                        We're sorry to see you go. If you're sure you want to delete your account, please follow the steps below.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <h3 className="font-semibold text-amber-900 flex items-center mb-2">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Warning: Irreversible Action
                        </h3>
                        <p className="text-sm text-amber-800">
                            Deleting your account will permanently remove all your data, campaigns, and settings. This action cannot be undone.
                        </p>
                    </div>

                    <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
                        <h3 className="font-semibold text-gray-900">How to delete:</h3>
                        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
                            <li>Go to your <strong>Account Settings</strong>.</li>
                            <li>Scroll to the bottom of the page.</li>
                            <li>Click the <strong>Delete Account</strong> button.</li>
                            <li>Enter your password to confirm.</li>
                        </ol>
                    </div>
                </div>

                <div className="flex flex-col space-y-3 pt-4">
                    <Link to="/dashboard">
                        <Button className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg text-lg font-medium transition-colors">
                            <ArrowLeft className="mr-2 h-5 w-5" />
                            Return to Dashboard
                        </Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
};

export default DeleteAccountGuidePage;
