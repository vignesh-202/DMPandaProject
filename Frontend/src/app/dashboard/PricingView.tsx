import React, { useState, useEffect } from 'react';
import { Check, Zap, Loader2, Globe, Sparkles } from 'lucide-react';
import Card from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

interface Plan {
    id: string;
    name: string;
    price_monthly_inr: number;
    price_yearly_inr: number;
    price_monthly_usd: number;
    price_yearly_usd: number;
    features: string[];
    is_popular: boolean;
    button_text: string;
    yearly_bonus: string;
}

const PricingView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false);
    const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
    const [isIndianUser, setIsIndianUser] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Fetch Country
                const geoRes = await fetch('https://api.country.is/');
                const geoData = await geoRes.json();
                if (geoData?.country === 'IN') {
                    setIsIndianUser(true);
                    setCurrency('INR');
                }

                // Fetch Plans
                const plansRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`);
                if (plansRes.ok) {
                    const plansData = await plansRes.json();
                    setPlans(plansData);
                }
            } catch (error) {
                console.error('Error initializing pricing:', error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handlePayment = async (plan: Plan) => {
        if (plan.name === 'Free') return;

        setPaymentLoading(plan.id);
        try {
            const amount = currency === 'INR'
                ? (isYearly ? plan.price_yearly_inr : plan.price_monthly_inr)
                : (isYearly ? plan.price_yearly_usd : plan.price_monthly_usd);

            // 1. Create Order
            const orderResponse = await authenticatedFetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amount * 100, // Razorpay expects paise/cents
                    currency: currency
                }),
            });

            if (!orderResponse.ok) throw new Error('Failed to create order');
            const orderData = await orderResponse.json();

            // 2. Load Razorpay
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);

            script.onload = () => {
                const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SEjUlisckzqoqx',
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: 'DM Panda',
                    description: `Upgrade to ${plan.name} (${isYearly ? 'Yearly' : 'Monthly'})`,
                    order_id: orderData.id,
                    handler: async (response: any) => {
                        // 3. Verify Payment
                        const verifyResponse = await authenticatedFetch('/api/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                plan_id: plan.name,
                                is_yearly: isYearly
                            }),
                        });

                        if (verifyResponse.ok) {
                            alert('Success! Your plan has been upgraded.');
                            window.location.reload();
                        } else {
                            alert('Payment verification failed. Please contact support.');
                        }
                    },
                    prefill: {
                        name: 'User',
                        email: 'user@example.com',
                    },
                    theme: { color: '#000000' },
                };
                const rzp = new (window as any).Razorpay(options);
                rzp.open();
            };
        } catch (error) {
            console.error('Payment error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setPaymentLoading(null);
        }
    };

    if (loading) return <LoadingOverlay variant="fullscreen" message="Loading Pricing" subMessage="Fetching your plans..." />;

    return (
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto mb-20 animate-in fade-in duration-500">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-black mb-4 text-foreground flex items-center justify-center gap-3">
                    Upgrade Your Growth <Sparkles className="text-yellow-500" />
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Scale your Instagram presence with powerful automation limits and advanced features.
                </p>

                <div className="flex flex-col items-center mt-10 space-y-6">
                    <div className="bg-muted p-1 rounded-2xl inline-flex relative border border-border">
                        <button
                            onClick={() => setIsYearly(false)}
                            className={`relative z-10 px-8 py-2 rounded-xl text-sm font-bold transition-all ${!isYearly ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            className={`relative z-10 px-8 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${isYearly ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Yearly
                            <span className="bg-success-muted/60 text-success text-[10px] px-2 py-0.5 rounded-full">Save 20%</span>
                        </button>
                    </div>

                    {isIndianUser && (
                        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                            <span className={currency === 'INR' ? 'text-foreground' : ''}>INR</span>
                            <button
                                onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}
                                className="w-10 h-5 bg-muted rounded-full relative"
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-card rounded-full transition-all ${currency === 'INR' ? 'left-1' : 'left-6'}`} />
                            </button>
                            <span className={currency === 'USD' ? 'text-foreground' : ''}>USD</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <Card
                        key={plan.id}
                        className={`relative flex flex-col p-8 transition-all duration-300 ${plan.is_popular
                                ? 'border-2 border-primary shadow-2xl scale-105 z-10'
                                : 'border-border hover:border-border/70'
                            }`}
                    >
                        {plan.is_popular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                                MOST POPULAR
                            </div>
                        )}

                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-foreground">
                                    {currency === 'INR' ? 'â‚¹' : '$'}
                                    {currency === 'INR'
                                        ? (isYearly ? plan.price_yearly_inr : plan.price_monthly_inr)
                                        : (isYearly ? plan.price_yearly_usd : plan.price_monthly_usd)}
                                </span>
                                <span className="text-muted-foreground text-sm">/month</span>
                            </div>
                            {isYearly && plan.yearly_bonus && (
                                <p className="text-green-500 text-xs font-bold mt-2">{plan.yearly_bonus}</p>
                            )}
                        </div>

                        <div className="space-y-4 flex-grow mb-8">
                            {plan.features.map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm">
                                    <div className="text-green-500 mt-0.5 flex-shrink-0">
                                        <Check size={16} strokeWidth={3} />
                                    </div>
                                    <span className="text-muted-foreground">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => handlePayment(plan)}
                            disabled={plan.name === 'Free' || !!paymentLoading}
                            className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${plan.name === 'Free'
                                    ? 'bg-muted text-muted-foreground cursor-default'
                                    : plan.is_popular
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                        : 'bg-foreground text-background hover:opacity-90 shadow-lg'
                                }`}
                        >
                            {paymentLoading === plan.id ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : plan.name === 'Free' ? (
                                'Active Plan'
                            ) : (
                                plan.button_text
                            )}
                        </button>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default PricingView;

