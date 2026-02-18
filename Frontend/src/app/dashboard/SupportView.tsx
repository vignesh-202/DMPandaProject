import React, { useState } from 'react';
import Card from '../../components/ui/card';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react';

const SupportView = () => {
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    const toggleAccordion = (id: string) => {
        setOpenAccordion(openAccordion === id ? null : id);
    };

    return (
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Support</h2>
                <p className="text-muted-foreground">Need help? Find answers to common questions or contact our support team.</p>
            </div>

            <section>
                <h3 className="text-xl font-semibold text-foreground mb-4">Getting Started with DM Panda</h3>
                <p className="text-muted-foreground mb-6">Follow these simple steps to begin automating your Instagram DMs:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border border-content shadow-sm transition-all hover:border-border/70">
                        <div className="p-4 text-center">
                            <div className="text-3xl font-bold text-foreground mb-2">1</div>
                            <h4 className="text-lg font-bold text-foreground mb-2">Connect Account</h4>
                            <p className="text-sm text-muted-foreground">Securely link your Instagram account to DM Panda through your dashboard.</p>
                        </div>
                    </Card>
                    <Card className="border border-content shadow-sm transition-all hover:border-border/70">
                        <div className="p-4 text-center">
                            <div className="text-3xl font-bold text-foreground mb-2">2</div>
                            <h4 className="text-lg font-bold text-foreground mb-2">Set Up Campaigns</h4>
                            <p className="text-sm text-muted-foreground">Define your target audience and create your automated message sequences.</p>
                        </div>
                    </Card>
                    <Card className="border border-content shadow-sm transition-all hover:border-border/70">
                        <div className="p-4 text-center">
                            <div className="text-3xl font-bold text-foreground mb-2">3</div>
                            <h4 className="text-lg font-bold text-foreground mb-2">Launch & Monitor</h4>
                            <p className="text-sm text-muted-foreground">Start your automation and track results and engagement through the dashboard.</p>
                        </div>
                    </Card>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-semibold text-foreground mb-4">Frequently Asked Questions (FAQ)</h3>
                <div className="space-y-4">
                    <Card className="!p-0 overflow-hidden border border-content shadow-sm transition-all">
                        <button
                            onClick={() => toggleAccordion('faq1')}
                            className="w-full flex justify-between items-center p-4 text-left bg-card hover:bg-muted/40 transition-colors"
                        >
                            <span className="font-medium text-foreground">How do I connect my Instagram account?</span>
                            {openAccordion === 'faq1' ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                        </button>
                        <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${openAccordion === 'faq1' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            <div className="p-4 border-t border-border text-muted-foreground">
                                Follow the step-by-step guide in the "Get Started" section after logging into your DM Panda dashboard.
                                Ensure you have admin access to the linked Facebook Page.
                            </div>
                        </div>
                    </Card>

                    <Card className="!p-0 overflow-hidden border border-content shadow-sm transition-all">
                        <button
                            onClick={() => toggleAccordion('faq2')}
                            className="w-full flex justify-between items-center p-4 text-left bg-card hover:bg-muted/40 transition-colors"
                        >
                            <span className="font-medium text-foreground">Is DM Panda compliant with Instagram's policies?</span>
                            {openAccordion === 'faq2' ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                        </button>
                        <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${openAccordion === 'faq2' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            <div className="p-4 border-t border-border text-muted-foreground">
                                Yes, DM Panda utilizes the official Meta API for Instagram messaging, ensuring compliance with their
                                terms of service. We recommend using automation responsibly.
                            </div>
                        </div>
                    </Card>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-semibold text-foreground mb-4">Contact Support</h3>
                <p className="text-muted-foreground mb-4">If you couldn't find an answer in the FAQ, please reach out to our support team.</p>
                <a
                    href="/contact"
                    className="inline-flex items-center px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
                >
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Us
                </a>
            </section>
        </div>
    );
};

export default SupportView;

