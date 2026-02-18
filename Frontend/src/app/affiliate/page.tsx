import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, DollarSign, Clock, Shield, Gift, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';

const AffiliatePage: React.FC = () => {
    useEffect(() => {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
    }, []);

    const benefits = [
        {
            icon: <DollarSign className="w-8 h-8" />,
            title: "Lifetime 10% Commission",
            description: "Earn 10% commission for life on every payment your referral makes in the app."
        },
        {
            icon: <Gift className="w-8 h-8" />,
            title: "₹100 Per Referral",
            description: "Get ₹100 instantly for every successful verified active user you refer."
        },
        {
            icon: <TrendingUp className="w-8 h-8" />,
            title: "Brand Promotion",
            description: "Impressive social media presence? We may contact you for exclusive brand promotions."
        },
        {
            icon: <Users className="w-8 h-8" />,
            title: "No Limit on Referrals",
            description: "Refer as many users as you want. The more referrals, the more you earn!"
        }
    ];

    const eligibilityOptions = [
        {
            title: "Social Media Influencer",
            description: "Have a significant follower count on Instagram or YouTube",
            details: [
                "Submit your Instagram or YouTube profile links",
                "Our team will review your social media presence",
                "If impressed, you'll get approved + potential brand deals",
                "Special benefits for top creators"
            ],
            icon: <Users className="w-12 h-12 text-purple-600" />
        },
        {
            title: "Active Subscriber",
            description: "Have an active Basic plan or higher subscription",
            details: [
                "Subscribe to any monthly or yearly Basic plan or above",
                "Your affiliate account is automatically activated",
                "Start sharing your referral link immediately",
                "Track earnings in your dashboard"
            ],
            icon: <Shield className="w-12 h-12 text-green-600" />
        }
    ];

    const rules = [
        { text: "Minimum payout threshold is ₹2,500", type: "info" },
        { text: "Withdrawals processed within 90 days after reaching minimum amount", type: "info" },
        { text: "Lifetime 10% commission on all payments from your referrals", type: "success" },
        { text: "₹100 bonus per verified active user signup", type: "success" },
        { text: "If referred user deletes account within 90 days, referral is cancelled", type: "warning" },
        { text: "If referred user is inactive for 90 days, referral is cancelled", type: "warning" }
    ];

    return (
        <section className="min-h-screen bg-white font-sans text-gray-900">
            {/* Hero Section */}
            <div className="bg-black text-white pt-24 pb-32 rounded-b-[40px] md:rounded-b-[80px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gray-800 rounded-full blur-[100px] opacity-30 -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700 rounded-full blur-[80px] opacity-20 translate-y-1/3 -translate-x-1/3"></div>

                <div className="container mx-auto px-4 text-center relative z-10">
                    <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
                        Affiliate Program
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
                        Earn money by sharing DM Panda with your audience. Get lifetime commissions and exclusive benefits.
                    </p>
                    <AuthRedirectButton className="bg-white text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition-all transform hover:scale-105 shadow-lg">
                        Join Affiliate Program
                    </AuthRedirectButton>
                </div>
            </div>

            {/* Benefits Section */}
            <div className="container mx-auto px-4 -mt-20 relative z-20 mb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {benefits.map((benefit, index) => (
                        <div
                            key={index}
                            className="bg-white p-8 rounded-2xl shadow-xl border-t border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-2"
                        >
                            <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mb-6 shadow-md">
                                {benefit.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                            <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Eligibility Section */}
            <div className="bg-gray-50 py-24">
                <div className="container mx-auto px-4">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-6">How to Become an Affiliate?</h2>
                    <p className="text-center text-xl text-gray-600 mb-16 max-w-2xl mx-auto">
                        Choose one of the two paths to join our affiliate program
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {eligibilityOptions.map((option, index) => (
                            <div
                                key={index}
                                className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 hover:border-black/10 transition-all duration-300"
                            >
                                <div className="flex items-center gap-6 mb-8">
                                    <div className="p-4 bg-gray-50 rounded-2xl">
                                        {option.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold">{option.title}</h3>
                                        <p className="text-gray-600">{option.description}</p>
                                    </div>
                                </div>
                                <ul className="space-y-4">
                                    {option.details.map((detail, i) => (
                                        <li key={i} className="flex items-start gap-4">
                                            <CheckCircle className="w-6 h-6 text-black flex-shrink-0 mt-0.5" />
                                            <span className="text-gray-700 text-lg">{detail}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Terms & Rules Section */}
            <div className="container mx-auto px-4 py-24">
                <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">Program Rules & Terms</h2>
                <div className="max-w-4xl mx-auto grid gap-6">
                    {rules.map((rule, index) => (
                        <div
                            key={index}
                            className={`flex items-start gap-5 p-6 rounded-2xl border transition-all ${rule.type === 'success' ? 'bg-green-50/50 border-green-200' :
                                rule.type === 'warning' ? 'bg-amber-50/50 border-amber-200' :
                                    'bg-blue-50/50 border-blue-200'
                                }`}
                        >
                            {rule.type === 'success' ? (
                                <CheckCircle className="w-7 h-7 text-green-600 flex-shrink-0" />
                            ) : rule.type === 'warning' ? (
                                <XCircle className="w-7 h-7 text-amber-600 flex-shrink-0" />
                            ) : (
                                <Clock className="w-7 h-7 text-blue-600 flex-shrink-0" />
                            )}
                            <span className={`text-lg font-medium ${rule.type === 'success' ? 'text-green-900' :
                                rule.type === 'warning' ? 'text-amber-900' :
                                    'text-blue-900'
                                }`}>
                                {rule.text}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works Section */}
            <div className="bg-black text-white py-24">
                <div className="container mx-auto px-4">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">How It Works</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-6xl mx-auto">
                        {[
                            { step: "1", title: "Sign Up", desc: "Create your DM Panda account" },
                            { step: "2", title: "Get Approved", desc: "Submit social links or subscribe to a plan" },
                            { step: "3", title: "Share", desc: "Get your unique referral link" },
                            { step: "4", title: "Earn", desc: "Get commissions for every referral" }
                        ].map((item, index) => (
                            <div key={index} className="text-center relative">
                                <div className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-gray-400 text-lg">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="container mx-auto px-4 py-32 text-center">
                <div className="max-w-3xl mx-auto bg-gray-50 rounded-[3rem] p-12 md:p-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-8 text-black leading-tight">Ready to Start Earning?</h2>
                    <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
                        Join thousands of affiliates earning passive income with DM Panda.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-6 justify-center">
                        <AuthRedirectButton className="bg-black text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-all shadow-xl">
                            Get Started Now
                        </AuthRedirectButton>
                        <Link
                            to="/contact"
                            className="border-2 border-black text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-black hover:text-white transition-all"
                        >
                            Contact Us
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AffiliatePage;
