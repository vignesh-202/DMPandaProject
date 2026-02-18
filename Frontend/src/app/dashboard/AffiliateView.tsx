import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/AuthContext';
import {
    Users, Shield, DollarSign,
    Youtube, Instagram, CheckCircle,
    Copy, TrendingUp,
    Clock, ArrowUpRight,
    Wallet, Download
} from 'lucide-react';
import ModernLoader from '../../components/ui/ModernLoader';

// Mock Data Types
interface Referral {
    id: string;
    user: string;
    date: string;
    status: 'pending' | 'qualified' | 'paid' | 'cancelled';
    commission: number;
    plan: string;
}

interface Payout {
    id: string;
    date: string;
    amount: number;
    status: 'processing' | 'paid' | 'rejected';
    method: string;
}

const AffiliateView: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'payouts' | 'settings'>('overview');
    const [activationTab, setActivationTab] = useState<'influencer' | 'subscriber'>('subscriber');

    // Form States
    const [instagramLink, setInstagramLink] = useState('');
    const [youtubeLink, setYoutubeLink] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Mock Affiliate State (Simulating API fetch)
    const [affiliateStatus, setAffiliateStatus] = useState<'inactive' | 'pending' | 'active'>('inactive');
    const [isLoading, setIsLoading] = useState(true);

    const referralCode = user?.$id?.slice(0, 8).toUpperCase() || 'PANDA88';
    const referralLink = `https://dmpanda.com/signup?ref=${referralCode}`;

    // Mock Data
    const stats = {
        totalEarnings: 12500,
        pendingBalance: 4500,
        availablePayout: 8000,
        totalReferrals: 42,
        activeReferrals: 18,
        conversionRate: 12.5
    };

    const referrals: Referral[] = [
        { id: '1', user: 'alex_***', date: '2024-12-01', status: 'qualified', commission: 250, plan: 'Basic Monthly' },
        { id: '2', user: 'sarah_***', date: '2024-12-03', status: 'pending', commission: 150, plan: 'Basic Monthly' },
        { id: '3', user: 'mike_***', date: '2024-12-05', status: 'cancelled', commission: 0, plan: 'Global Strings' },
        { id: '4', user: 'jess_***', date: '2024-12-06', status: 'paid', commission: 500, plan: 'Pro Yearly' },
        { id: '5', user: 'david_***', date: '2024-12-07', status: 'qualified', commission: 150, plan: 'Basic Monthly' },
    ];

    const payouts: Payout[] = [
        { id: 'PO-1023', date: '2024-11-15', amount: 5000, status: 'paid', method: 'Bank Transfer' },
        { id: 'PO-1024', date: '2024-12-01', amount: 2500, status: 'processing', method: 'PayPal' },
    ];

    useEffect(() => {
        // In real app this would be based on backend response; no artificial delay
        setAffiliateStatus('inactive');
        setIsLoading(false);
    }, []);

    const handleInfluencerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instagramLink && !youtubeLink) {
            setError('Please provide at least one social media link.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        setIsSubmitting(false);
        setSuccessMessage('Application submitted successfully! Review takes ~48h.');
        setAffiliateStatus('pending');
    };

    const handleSubscriberActivation = async () => {
        setIsSubmitting(true);
        setError(null);
        setIsSubmitting(false);
        setAffiliateStatus('active');
        setSuccessMessage('Affiliate account activated successfully!');
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <ModernLoader size="lg" className="text-foreground" />
            </div>
        );
    }

    // ----------------------------------------------------------------------
    // View: Onboarding (Inactive / Pending)
    // ----------------------------------------------------------------------
    if (affiliateStatus === 'inactive' || affiliateStatus === 'pending') {
        return (
            <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-4">
                    <h1 className="text-3xl font-bold text-foreground">Join the DM Panda Affiliate Program</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Earn lifetime commissions while helping creators automate their growth.
                    </p>
                </div>

                {affiliateStatus === 'pending' && (
                    <Card className="p-8 border-warning/30 bg-warning-muted/40">
                        <div className="flex flex-col items-center text-center gap-4">
                            <Clock className="w-12 h-12 text-warning" />
                            <h2 className="text-2xl font-bold text-warning">
                                Application Under Review
                            </h2>
                            <p className="text-warning/80 max-w-lg">
                                Thanks for applying! Our team is reviewing your profile. You'll receive an email update within 48 hours.
                            </p>
                        </div>
                    </Card>
                )}

                {successMessage && !affiliateStatus.includes('inactive') && (
                    <div className="p-4 bg-success-muted/60 border border-success/30 text-success rounded-lg text-center animate-in fade-in slide-in-from-top-2">
                        {successMessage}
                    </div>
                )}

                {affiliateStatus === 'inactive' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Subscriber Path */}
                        <Card className={`p-8 cursor-pointer transition-all border-2 ${activationTab === 'subscriber' ? 'border-success ring-4 ring-success/15' : 'border-transparent hover:border-border'}`}
                            onClick={() => setActivationTab('subscriber')}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-success-muted/60 rounded-xl">
                                    <Shield className="w-8 h-8 text-success" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">I'm a Subscriber</h3>
                            </div>
                            <p className="text-muted-foreground mb-6">
                                Instant approval for active Basic+ plan subscribers. Start earning immediately.
                            </p>
                            <ul className="space-y-3 mb-8">
                                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="w-4 h-4 text-success" /> Active Basic plan or higher
                                </li>
                                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="w-4 h-4 text-success" /> Instant activation
                                </li>
                            </ul>
                            {activationTab === 'subscriber' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <Button
                                        onClick={handleSubscriberActivation}
                                        disabled={isSubmitting}
                                        className="w-full bg-foreground text-background hover:bg-foreground/90 h-11 "
                                    >
                                        {isSubmitting ? <ModernLoader size="sm" variant="black" /> : 'Activate Now'}
                                    </Button>
                                    {isSubmitting && <p className="text-center text-xs text-muted-foreground mt-2">Verifying subscription...</p>}
                                </div>
                            )}
                        </Card>

                        {/* Influencer Path */}
                        <Card className={`p-8 cursor-pointer transition-all border-2 ${activationTab === 'influencer' ? 'border-primary ring-4 ring-primary/15' : 'border-transparent hover:border-border'}`}
                            onClick={() => setActivationTab('influencer')}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <Users className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">I'm an Influencer</h3>
                            </div>
                            <p className="text-muted-foreground mb-6">
                                Apply with your social media profile. No subscription required.
                            </p>
                            <ul className="space-y-3 mb-8">
                                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="w-4 h-4 text-primary" /> Manual review (24-48h)
                                </li>
                                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="w-4 h-4 text-primary" /> Exclusive perks & deals
                                </li>
                            </ul>
                            {activationTab === 'influencer' && (
                                <form onSubmit={handleInfluencerSubmit} className="animate-in fade-in slide-in-from-top-2 space-y-4">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Instagram className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
                                            <Input
                                                placeholder="Instagram Profile URL"
                                                className="pl-10"
                                                value={instagramLink}
                                                onChange={(e) => setInstagramLink(e.target.value)}
                                            />
                                        </div>
                                        <div className="relative">
                                            <Youtube className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
                                            <Input
                                                placeholder="YouTube Channel URL"
                                                className="pl-10"
                                                value={youtubeLink}
                                                onChange={(e) => setYoutubeLink(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {error && <p className="text-destructive text-sm">{error}</p>}
                                    <Button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
                                        {isSubmitting ? <ModernLoader size="sm" variant="white" /> : 'Submit Application'}
                                    </Button>
                                </form>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        );
    }

    // ----------------------------------------------------------------------
    // View: Dashboard (Active)
    // ----------------------------------------------------------------------
    return (
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Affiliate Dashboard</h2>
                    <p className="text-muted-foreground">Track referrals, earnings, and payouts.</p>
                </div>
                <div className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg shadow-sm">
                    <span className="text-sm font-medium">Available Balance:</span>
                    <span className="text-lg font-bold">₹{stats.availablePayout.toLocaleString()}</span>
                    {stats.availablePayout >= 2500 && (
                        <Button size="sm" variant="secondary" className="ml-2 text-xs h-7">
                            Request Payout
                        </Button>
                    )}
                </div>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                            <h3 className="text-2xl font-bold mt-1 text-foreground">₹{stats.totalEarnings.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-success-muted/60 rounded-lg">
                            <DollarSign className="w-5 h-5 text-success" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-xs text-success">
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        <span>+12% from last month</span>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Pending</p>
                            <h3 className="text-2xl font-bold mt-1 text-foreground">₹{stats.pendingBalance.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-warning-muted/40 rounded-lg">
                            <Clock className="w-5 h-5 text-warning" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground">
                        Clears after 15 days
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Referrals</p>
                            <h3 className="text-2xl font-bold mt-1 text-foreground">{stats.totalReferrals}</h3>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-xs text-primary">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        <span>{stats.activeReferrals} Active Users</span>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                            <h3 className="text-2xl font-bold mt-1 text-foreground">{stats.conversionRate}%</h3>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground">
                        Clicks vs Signups
                    </div>
                </Card>
            </div>

            {/* Referral Link Section */}
            <Card className="p-6 bg-secondary/60 border border-border">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold mb-2 text-foreground">Share Your Unique Referral Link</h3>
                        <p className="text-muted-foreground text-sm mb-0">
                            Earn 10% lifetime recurring commission + ₹100 bonus for every active user.
                        </p>
                    </div>
                    <div className="w-full md:w-auto flex gap-2">
                        <div className="relative flex-1 md:w-80">
                            <Input
                                value={referralLink}
                                readOnly
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground pr-10 h-11"
                            />
                            <Copy className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" />
                        </div>
                        <Button
                            onClick={copyToClipboard}
                            className={`h-11 px-6 font-bold ${copied ? 'bg-success text-success-foreground' : 'bg-foreground text-background hover:bg-foreground/90'}`}
                        >
                            {copied ? 'Copied!' : 'Copy Link'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Main Content Tabs */}
            <div className="space-y-4">
                <div className="border-b border-border">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {['overview', 'referrals', 'payouts', 'settings'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors
                                    ${activeTab === tab
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab: Overview */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
                        <Card className="col-span-1 lg:col-span-2 p-6">
                            <h3 className="font-bold text-lg mb-4 text-foreground">Earnings History</h3>
                            <div className="h-64 flex items-center justify-center bg-muted/40 rounded-lg border border-dashed border-border">
                                <p className="text-muted-foreground">Chart Visualization Placeholder</p>
                            </div>
                        </Card>
                        <Card className="p-6">
                            <h3 className="font-bold text-lg mb-4 text-foreground">Recent Activity</h3>
                            <div className="space-y-4">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 pb-3 border-b last:border-0 border-border/60">
                                        <div className="w-8 h-8 rounded-full bg-success-muted/60 flex items-center justify-center">
                                            <DollarSign className="w-4 h-4 text-success" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Commission Earned</p>
                                            <p className="text-xs text-muted-foreground">From user alex_{i}***</p>
                                        </div>
                                        <span className="text-sm font-bold text-success">+₹250</span>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" className="w-full mt-4 text-sm">View All Activity</Button>
                        </Card>
                    </div>
                )}

                {/* Tab: Referrals */}
                {activeTab === 'referrals' && (
                    <Card className="overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Commission</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                    {referrals.map((referral) => (
                                        <tr key={referral.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{referral.user}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{referral.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{referral.plan}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-bold">₹{referral.commission}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                    ${referral.status === 'qualified' || referral.status === 'paid' ? 'bg-success-muted/60 text-success' :
                                                        referral.status === 'pending' ? 'bg-warning-muted/50 text-warning' :
                                                            'bg-muted text-muted-foreground'}`}>
                                                    {referral.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {referrals.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">No referrals yet. Share your link to get started!</div>
                        )}
                    </Card>
                )}

                {/* Tab: Payouts */}
                {activeTab === 'payouts' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="p-6">
                                <h3 className="text-lg font-bold mb-2 text-foreground">Available for Payout</h3>
                                <div className="text-3xl font-bold mb-4 text-foreground">₹{stats.availablePayout.toLocaleString()}</div>
                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Min. Threshold</span>
                                        <span className="font-medium text-foreground">₹2,500</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div className="bg-foreground h-2 rounded-full" style={{ width: `${Math.min((stats.availablePayout / 2500) * 100, 100)}%` }}></div>
                                    </div>
                                </div>
                                <Button className="w-full bg-foreground text-background " disabled={stats.availablePayout < 2500}>
                                    {stats.availablePayout < 2500 ? 'Threshold Not Met' : 'Request Payout'}
                                </Button>
                            </Card>
                            <Card className="p-6">
                                <h3 className="text-lg font-bold mb-4 text-foreground">Payout Method</h3>
                                <div className="flex items-center gap-4 p-4 border border-border rounded-lg mb-4">
                                    <div className="p-2 bg-muted rounded-full">
                                        <Wallet className="w-6 h-6 text-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">Bank Transfer (**** 4291)</p>
                                        <p className="text-xs text-muted-foreground">Primary Method</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="ml-auto">Edit</Button>
                                </div>
                                <Button variant="outline" className="w-full">Add New Method</Button>
                            </Card>
                        </div>

                        <Card className="overflow-hidden">
                            <h3 className="text-lg font-bold p-6 pb-2 text-foreground">Payout History</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-border">
                                    <thead className="bg-muted/40">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Method</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-card divide-y divide-border">
                                        {payouts.map((payout) => (
                                            <tr key={payout.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{payout.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-muted-foreground">{payout.id}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">₹{payout.amount.toLocaleString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{payout.method}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                        ${payout.status === 'paid' ? 'bg-success-muted/60 text-success' :
                                                            payout.status === 'processing' ? 'bg-primary/10 text-primary' :
                                                                'bg-destructive-muted/50 text-destructive'}`}>
                                                        {payout.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <Download className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Tab: Settings */}
                {activeTab === 'settings' && (
                    <Card className="p-6 max-w-2xl animate-in slide-in-from-bottom-2 fade-in duration-300">
                        <h3 className="text-lg font-bold mb-6 text-foreground">Affiliate Settings</h3>
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-medium mb-4 text-foreground">Payout Settings</h4>
                                <p className="text-sm text-muted-foreground mb-4">Configure where you want to receive your commissions.</p>
                                <Button variant="outline">Manage Payout Methods</Button>
                            </div>
                            <div className="pt-6 border-t border-border">
                                <h4 className="font-medium mb-4 text-foreground">Notification Preferences</h4>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3">
                                        <input type="checkbox" className="rounded border-border transform scale-125 accent-foreground" defaultChecked />
                                        <span className="text-sm text-foreground">Email me when I get a new referral</span>
                                    </label>
                                    <label className="flex items-center gap-3">
                                        <input type="checkbox" className="rounded border-border transform scale-125 accent-foreground" defaultChecked />
                                        <span className="text-sm text-foreground">Email me when payouts are processed</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default AffiliateView;


