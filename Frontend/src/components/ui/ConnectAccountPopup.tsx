import React, { useState, useEffect } from 'react';
import Card from './card';
import { Button } from './button';
import { Instagram, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

interface ConnectAccountPopupProps {
    isOpen?: boolean;
    children?: React.ReactNode;
    forceShow?: boolean; // If true, ignore igAccounts check and just show based on activeAccount status
}

const ConnectAccountPopup: React.FC<ConnectAccountPopupProps> = ({ isOpen, children, forceShow }) => {
    const { activeAccount, setCurrentView, igAccounts } = useDashboard();
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        // If forceShow is provided, we use it to determine if we should show the popup
        // based on the active account's status.
        if (forceShow) {
            if (!activeAccount || activeAccount.status !== 'active') {
                setShowPopup(true);
            } else {
                setShowPopup(false);
            }
        } else if (typeof isOpen !== 'undefined') {
            setShowPopup(isOpen);
        }
    }, [isOpen, forceShow, activeAccount]);

    const handleClick = (e: React.MouseEvent) => {
        if (children) {
            // If no accounts at all, or active account is unlinked/invalid
            if (!igAccounts || igAccounts.length === 0 || (activeAccount && activeAccount.status !== 'active')) {
                e.preventDefault();
                e.stopPropagation();
                setShowPopup(true);
            }
        }
    };

    return (
        <>
            {children && (
                <div onClickCapture={handleClick} className="contents">
                    {children}
                </div>
            )}

            {showPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <Card className="w-full max-w-md p-8 shadow-2xl border-0 relative overflow-hidden bg-white dark:bg-gray-900 rounded-3xl">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2 shadow-inner">
                                    {activeAccount?.profile_picture_url ? (
                                        <img
                                            src={activeAccount.profile_picture_url}
                                            alt="Account"
                                            className="w-20 h-20 rounded-full grayscale opacity-50"
                                        />
                                    ) : (
                                        <Instagram className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-2 border-4 border-white dark:border-gray-900 shadow-lg">
                                    <AlertCircle className="h-5 w-5 text-white" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Account Connection Required
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-base">
                                    {activeAccount
                                        ? `The account @${activeAccount.username} is currently unlinked. Please link it back to continue.`
                                        : "Please link an Instagram account to access this feature."}
                                </p>
                            </div>

                            <div className="w-full pt-4 space-y-3">
                                <Button
                                    onClick={() => {
                                        setShowPopup(false);
                                        setCurrentView('Account Settings');
                                    }}
                                    className="w-full py-7 text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xl transition-all duration-300 transform hover:scale-[1.02] rounded-2xl"
                                >
                                    <LinkIcon className="mr-3 h-6 w-6" />
                                    Account Settings
                                </Button>
                                {!forceShow && (
                                    <button
                                        onClick={() => setShowPopup(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-medium transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

export default ConnectAccountPopup;
