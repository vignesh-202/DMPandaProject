import React from 'react';
import { Link } from 'react-router-dom';
import { Users, DollarSign, Clock, Shield, Gift, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';

const AffiliatePage: React.FC = () => {
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
        <section className="min-h-screen bg-gradient-to-b from-white to-gray-50">
            {/* Hero Section */}
            <div className="bg-black text-white py-20">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6">
                        Affiliate Program
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8">
                        Earn money by sharing DM Panda with your audience. Get lifetime commissions and exclusive benefits.
                    </p>
                    <AuthRedirectButton className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105">
                        Join Affiliate Program
                    </AuthRedirectButton>
                </div>
            </div>

            {/* Benefits Section */}
            <div className="container mx-auto px-4 py-16">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Why Join Our Affiliate Program?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {benefits.map((benefit, index) => (
                        <div
                            key={index}
                            className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1"
                        >
                            <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mb-4">
                                {benefit.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                            <p className="text-gray-600">{benefit.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Eligibility Section */}
            <div className="bg-gray-100 py-16">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How to Become an Affiliate?</h2>
                    <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                        Choose one of the two paths to join our affiliate program
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {eligibilityOptions.map((option, index) => (
                            <div
                                key={index}
                                className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200 hover:border-black transition-all"
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-3 bg-gray-100 rounded-xl">
                                        {option.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold">{option.title}</h3>
                                        <p className="text-gray-600">{option.description}</p>
                                    </div>
                                </div>
                                <ul className="space-y-3">
                                    {option.details.map((detail, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-gray-700">{detail}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Terms & Rules Section */}
            <div className="container mx-auto px-4 py-16">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Program Rules & Terms</h2>
                <div className="max-w-3xl mx-auto space-y-4">
                    {rules.map((rule, index) => (
                        <div
                            key={index}
                            className={`flex items-start gap-4 p-4 rounded-xl ${rule.type === 'success' ? 'bg-green-50 border border-green-200' :
                                    rule.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                                        'bg-blue-50 border border-blue-200'
                                }`}
                        >
                            {rule.type === 'success' ? (
                                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                            ) : rule.type === 'warning' ? (
                                <XCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                            ) : (
                                <Clock className="w-6 h-6 text-blue-600 flex-shrink-0" />
                            )}
                            <span className={`font-medium ${rule.type === 'success' ? 'text-green-800' :
                                    rule.type === 'warning' ? 'text-yellow-800' :
                                        'text-blue-800'
                                }`}>
                                {rule.text}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works Section */}
            <div className="bg-black text-white py-16">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
                        {[
                            { step: "1", title: "Sign Up", desc: "Create your DM Panda account" },
                            { step: "2", title: "Get Approved", desc: "Submit social links or subscribe to a plan" },
                            { step: "3", title: "Share", desc: "Get your unique referral link" },
                            { step: "4", title: "Earn", desc: "Get commissions for every referral" }
                        ].map((item, index) => (
                            <div key={index} className="text-center">
                                <div className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                                <p className="text-gray-400">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="container mx-auto px-4 py-16 text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Start Earning?</h2>
                <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                    Join thousands of affiliates earning passive income with DM Panda.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <AuthRedirectButton className="bg-black text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-all">
                        Get Started Now
                    </AuthRedirectButton>
                    <Link
                        to="/contact"
                        className="border-2 border-black text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-black hover:text-white transition-all"
                    >
                        Contact Us
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default AffiliatePage;
