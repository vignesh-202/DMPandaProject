import React, { useState } from 'react';
import Card from '../../components/ui/card';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react';

const SupportView = () => {
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    const toggleAccordion = (id: string) => {
        setOpenAccordion(openAccordion === id ? null : id);
    };

    return (
        <div className="p-6 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-black dark:text-white mb-2">Support</h2>
                <p className="text-gray-600 dark:text-gray-400">Need help? Find answers to common questions or contact our support team.</p>
            </div>

            <section>
                <h3 className="text-xl font-semibold text-black dark:text-white mb-4">Getting Started with DM Panda</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Follow these simple steps to begin automating your Instagram DMs:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <div className="p-4 text-center">
                            <div className="text-3xl font-bold text-black dark:text-white mb-2">1</div>
                            <h4 className="text-lg font-bold text-black dark:text-white mb-2">Connect Account</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Securely link your Instagram account to DM Panda through your dashboard.</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4 text-center">
                            <div className="text-3xl font-bold text-black dark:text-white mb-2">2</div>
                            <h4 className="text-lg font-bold text-black dark:text-white mb-2">Set Up Campaigns</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Define your target audience and create your automated message sequences.</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4 text-center">
                            <div className="text-3xl font-bold text-black dark:text-white mb-2">3</div>
                            <h4 className="text-lg font-bold text-black dark:text-white mb-2">Launch & Monitor</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Start your automation and track results and engagement through the dashboard.</p>
                        </div>
                    </Card>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-semibold text-black dark:text-white mb-4">Frequently Asked Questions (FAQ)</h3>
                <div className="space-y-4">
                    <Card className="!p-0 overflow-hidden">
                        <button
                            onClick={() => toggleAccordion('faq1')}
                            className="w-full flex justify-between items-center p-4 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <span className="font-medium text-black dark:text-white">How do I connect my Instagram account?</span>
                            {openAccordion === 'faq1' ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                        </button>
                        <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${openAccordion === 'faq1' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            <div className="p-4 border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                                Follow the step-by-step guide in the "Get Started" section after logging into your DM Panda dashboard.
                                Ensure you have admin access to the linked Facebook Page.
                            </div>
                        </div>
                    </Card>

                    <Card className="!p-0 overflow-hidden">
                        <button
                            onClick={() => toggleAccordion('faq2')}
                            className="w-full flex justify-between items-center p-4 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <span className="font-medium text-black dark:text-white">Is DM Panda compliant with Instagram's policies?</span>
                            {openAccordion === 'faq2' ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                        </button>
                        <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${openAccordion === 'faq2' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            <div className="p-4 border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                                Yes, DM Panda utilizes the official Meta API for Instagram messaging, ensuring compliance with their
                                terms of service. We recommend using automation responsibly.
                            </div>
                        </div>
                    </Card>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-semibold text-black dark:text-white mb-4">Contact Support</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">If you couldn't find an answer in the FAQ, please reach out to our support team.</p>
                <a
                    href="/contact"
                    className="inline-flex items-center px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-md hover:opacity-90 transition-opacity"
                >
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Us
                </a>
            </section>
        </div>
    );
};

export default SupportView;
