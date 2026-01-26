import { useState } from 'react';
import Card from '../../components/ui/card';
import { Check, Shield, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Load Razorpay script
const loadRazorpayCallback = (src: string) => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

const PricingView = () => {
    const { user, authenticatedFetch } = useAuth();
    const [loading, setLoading] = useState(false);

    const handlePayment = async (planName: string, amount: number) => {
        setLoading(true);
        const res = await loadRazorpayCallback('https://checkout.razorpay.com/v1/checkout.js');

        if (!res) {
            alert('Razorpay SDK failed to load. Are you online?');
            setLoading(false);
            return;
        }

        // 1. Create Order
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount * 100, // Amount in lowest denomination (paise)
                    currency: 'INR',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create order');
            }

            const order = await response.json();

            // 2. Open options
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
                amount: order.amount,
                currency: order.currency,
                name: "DMPanda",
                description: `${planName} Subscription`,
                image: "https://your-logo-url.com/logo.png", // Replace with actual logo if available
                order_id: order.id,
                handler: async function (response: any) {
                    // 3. Verify Payment
                    try {
                        const verifyRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/verify-payment`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });

                        if (verifyRes.ok) {
                            alert("Payment Successful! Your plan will be updated shortly.");
                        } else {
                            alert("Payment verification failed.");
                        }

                    } catch (error) {
                        console.error(error);
                        alert("Payment verification failed on server.");
                    }
                },
                prefill: {
                    name: user?.name,
                    email: user?.email,
                    contact: user?.phone, // Assuming phone is available or optional
                },
                notes: {
                    address: "Razorpay Corporate Office",
                },
                theme: {
                    color: "#000000",
                },
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.open();

        } catch (error: any) {
            console.error("Payment error: ", error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                    Simple, Transparent Pricing
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Choose the plan that's right for you
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Free Plan */}
                <Card className="relative p-8 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-300">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Free</h3>
                        <div className="flex items-baseline">
                            <span className="text-4xl font-bold">$0</span>
                            <span className="text-gray-500 ml-2">/month</span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">Perfect for getting started</p>

                        <button className="w-full py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            Current Plan
                        </button>

                        <ul className="space-y-3 pt-6">
                            <li className="flex items-center text-sm">
                                <Check className="w-4 h-4 mr-2 text-green-500" />
                                <span>Basic Automation</span>
                            </li>
                            <li className="flex items-center text-sm">
                                <Check className="w-4 h-4 mr-2 text-green-500" />
                                <span>100 DMs/month</span>
                            </li>
                            <li className="flex items-center text-sm">
                                <Check className="w-4 h-4 mr-2 text-green-500" />
                                <span>Basic Analytics</span>
                            </li>
                        </ul>
                    </div>
                </Card>

                {/* Pro Plan */}
                <Card className="relative p-8 border-2 border-black dark:border-white transform hover:scale-105 transition-all duration-300">
                    <div className="absolute top-0 right-0 bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                        Popular
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold flex items-center">
                            Pro <Zap className="w-4 h-4 ml-2 text-yellow-500" />
                        </h3>
                        <div className="flex items-baseline">
                            <span className="text-4xl font-bold">₹999</span>
                            <span className="text-gray-500 ml-2">/month</span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">For serious creators</p>

                        <button
                            onClick={() => handlePayment('Pro', 999)}
                            disabled={loading}
                            className="w-full py-2 px-4 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Upgrade now'}
                        </button>

                        <ul className="space-y-3 pt-6">
                            <li className="flex items-center text-sm">
                                <Check className="w-4 h-4 mr-2 text-black dark:text-white" />
                                <span>Advanced Automation</span>
                            </li>
                            <li className="flex items-center text-sm">
                                <Check className="w-4 h-4 mr-2 text-black dark:text-white" />
                                <span>Unlimited DMs</span>
                            </li>
                            <li className="flex items-center text-sm">
                                <Check className="w-4 h-4 mr-2 text-black dark:text-white" />
                                <span>Priority Support</span>
                            </li>
                            <li className="flex items-center text-sm">
                                <Check className="w-4 h-4 mr-2 text-black dark:text-white" />
                                <span>Advanced Analytics</span>
                            </li>
                        </ul>
                    </div>
                </Card>
            </div>

            <div className="text-center pt-8">
                <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Shield className="w-4 h-4 mr-1" /> Secure payment via Razorpay
                </p>
            </div>
        </div>
    );
};

export default PricingView;
