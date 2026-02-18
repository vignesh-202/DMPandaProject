import React, { useState, useEffect } from 'react';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';

const PricingPage: React.FC = () => {
  const [isYearly, setIsYearly] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [isIndianUser, setIsIndianUser] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');

    const fetchCountry = async () => {
      try {
        const response = await fetch('https://api.country.is/');
        const data = await response.json();
        if (data && data.country) {
          const countryCode = data.country;
          if (countryCode === 'IN') {
            setIsIndianUser(true);
            setCurrency('INR');
          } else {
            setIsIndianUser(false);
            setCurrency('USD');
          }
        }
      } catch (error) {
        console.error('Error fetching country:', error);
      }
    };

    fetchCountry();
  }, []);

  const handleToggle = () => {
    setIsYearly(!isYearly);
  };

  const handleCurrencyToggle = () => {
    setCurrency(currency === 'INR' ? 'USD' : 'INR');
  };

  const toggleAllCards = () => {
    setAllExpanded(!allExpanded);
  };

  const convertToUSD = (inr: number, planName: string, isYearly: boolean) => {
    if (planName === 'Basic') {
      return isYearly ? 6 : 8;
    }
    if (planName === 'Pro') {
      return isYearly ? 12 : 15;
    }
    if (planName === 'Ultra') {
      return isYearly ? 20 : 25;
    }
    return Math.ceil(inr / 90);
  };

  const plans = [
    {
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      features: [
        { name: '3 Instagram connections', included: true },
        { name: '100 actions/day', included: true },
        { name: '1,000 actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: 'Last 5 posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Reel comment DM automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Post comment DM automation', included: true },
        { name: 'Share reel to DM', included: false },
        { name: 'Share post to DM', included: false },
        { name: 'No Watermark', included: false },
      ],
      buttonText: 'Get Started',
      visibleFeatures: 6,
    },
    {
      name: 'Basic',
      price: { monthly: 599, yearly: 499 },
      features: [
        { name: '3 Instagram connection', included: true },
        { name: '100 actions/hour', included: true },
        { name: '30,000 actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: '15 posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Reel comment DM automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Post comment DM automation', included: true },
        { name: 'Share reel to DM', included: true },
        { name: 'Share post to DM', included: true },
        { name: 'No Watermark', included: true },
      ],
      buttonText: 'Choose Plan',
      visibleFeatures: 6,
    },
    {
      name: 'Pro',
      price: { monthly: 999, yearly: 799 },
      popular: true,
      yearlyBonus: '+ 2 months free',
      features: [
        { name: '5 Instagram connection', included: true },
        { name: '300 actions/hour', included: true },
        { name: '1,00,000 actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: 'Unlimited posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Reel comment DM automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Post comment DM automation', included: true },
        { name: 'Share reel to DM', included: true },
        { name: 'Share post to DM', included: true },
        { name: 'Automated reply for DM\'S with keywords', included: true },
        { name: 'Customised DM\'s for story mentions', included: true },
        { name: 'Button template for Links', included: true },
        { name: 'Instagram Live Automation', included: true },
        { name: 'Priority support', included: true },
        { name: 'Followers Only', included: true },
        { name: 'No Watermark', included: true },
      ],
      buttonText: 'Choose Plan',
      visibleFeatures: 6,
    },
    {
      name: 'Ultra',
      price: { monthly: 1999, yearly: 1599 },
      yearlyBonus: '+ 3 months free',
      features: [
        { name: '10 Instagram connections', included: true },
        { name: '500 actions/hour', included: true },
        { name: 'Unlimited actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: 'Unlimited posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Reel comment DM automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Post comment DM automation', included: true },
        { name: 'Share reel to DM', included: true },
        { name: 'Share post to DM', included: true },
        { name: 'Automated reply for DM\'S with keywords', included: true },
        { name: 'Customised DM\'s for story mentions', included: true },
        { name: 'Button template for Links', included: true },
        { name: 'Instagram Live Automation', included: true },
        { name: 'Webhook integrations', included: true },
        { name: 'Giveaway for Followers', included: true },
        { name: 'Priority support', included: true },
        { name: 'Followers Only', included: true },
        { name: 'No Watermark', included: true },
      ],
      buttonText: 'Choose Plan',
      visibleFeatures: 6,
    },
  ] as const;

  const comparisonFeatures = [
    { name: 'Instagram Connections', free: '3', basic: '3', pro: '5', ultra: '10' },
    { name: 'Actions/Day', free: '100', basic: '—', pro: '—', ultra: '—' },
    { name: 'Actions/Hour', free: '—', basic: '100', pro: '300', ultra: '500' },
    { name: 'Actions/Month', free: '1,000', basic: '30,000', pro: '1,00,000', ultra: 'Unlimited' },
    { name: 'Content Automations', free: 'Last 5 Posts/Reels', basic: '15 Posts/Reels', pro: 'Unlimited', ultra: 'Unlimited' },
    { name: 'Unlimited Contacts', free: true, basic: true, pro: true, ultra: true },
    { name: 'Reel/Post Reply Automation', free: true, basic: true, pro: true, ultra: true },
    { name: 'Reel/Post DM Automation', free: true, basic: true, pro: true, ultra: true },
    { name: 'Share Reel/Post to DM', free: false, basic: true, pro: true, ultra: true },
    { name: 'Automated DM Replies (Keywords)', free: false, basic: false, pro: true, ultra: true },
    { name: 'Story Mentions DMs', free: false, basic: false, pro: true, ultra: true },
    { name: 'Button Templates', free: false, basic: false, pro: true, ultra: true },
    { name: 'Instagram Live Automation', free: false, basic: false, pro: true, ultra: true },
    { name: 'Webhook Integrations', free: false, basic: false, pro: false, ultra: true },
    { name: 'Giveaway for Followers', free: false, basic: false, pro: false, ultra: true },
    { name: 'Priority Support', free: false, basic: false, pro: true, ultra: true },
    { name: 'Followers Only Mode', free: false, basic: false, pro: true, ultra: true },
    { name: 'No Watermark', free: false, basic: true, pro: true, ultra: true },
  ];

  return (
    <section className="min-h-screen bg-white text-gray-900 font-sans py-24">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-black mb-6 tracking-tight">Flexible Pricing for Everyone</h2>
          <p className="text-xl text-gray-600">Choose the plan that's right for you. Start free, upgrade as you grow. No hidden fees.</p>
        </div>

        <div className="flex flex-col items-center mb-16 space-y-8">
          <div className="bg-gray-100 p-1 rounded-full inline-flex relative">
            <div className="w-full h-full absolute inset-0 rounded-full bg-gray-100" />
            <button
              onClick={() => setIsYearly(false)}
              className={`relative z-10 px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${!isYearly ? 'bg-white shadow-md text-black' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`relative z-10 px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${isYearly ? 'bg-white shadow-md text-black' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Yearly
              <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Save 20%</span>
            </button>
          </div>

          {isIndianUser && (
            <div className="flex items-center gap-4 text-sm font-medium bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              <span className={`${currency === 'INR' ? 'text-black' : 'text-gray-400'}`}>INR</span>
              <button
                onClick={handleCurrencyToggle}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${currency === 'INR' ? 'bg-black' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${currency === 'INR' ? 'translate-x-0' : 'translate-x-6'}`} />
              </button>
              <span className={`${currency === 'USD' ? 'text-black' : 'text-gray-400'}`}>USD</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {plans.map((plan, index) => {
            const visibleFeatures = allExpanded ? plan.features : plan.features.slice(0, plan.visibleFeatures);
            const hasMoreFeatures = plan.features.length > plan.visibleFeatures;
            const isPro = plan.name === 'Pro';

            return (
              <div
                key={index}
                className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 ${isPro
                  ? 'bg-black text-white shadow-2xl scale-105 z-10 ring-4 ring-black/5'
                  : 'bg-white border border-gray-200 hover:shadow-xl hover:border-gray-300 text-gray-900'
                  }`}
              >
                {isPro && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl">
                    POPULAR
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6 h-20 flex flex-col justify-center">
                  {'custom' in plan.price && (plan.price as any).custom ? (
                    <span className="text-4xl font-bold">Custom</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        {currency === 'INR' ? '₹' : '$'}
                        {currency === 'INR'
                          ? isYearly
                            ? (plan.price as { yearly: number }).yearly
                            : (plan.price as { monthly: number }).monthly
                          : isYearly
                            ? convertToUSD((plan.price as { yearly: number }).yearly ?? 0, plan.name, true)
                            : convertToUSD((plan.price as { monthly: number }).monthly ?? 0, plan.name, false)}
                      </span>
                      <span className={`text-sm ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>/month</span>
                    </div>
                  )}
                  {isYearly && 'yearlyBonus' in plan && (
                    <p className="text-green-500 text-sm font-medium mt-1">{(plan as any).yearlyBonus}</p>
                  )}
                </div>

                <div className="space-y-4 flex-grow">
                  {visibleFeatures.map((feature, i) => {
                    let isIncluded = feature.included;
                    if ('yearly' in feature && (feature as any).yearly) {
                      isIncluded = isYearly;
                    }

                    return (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <div className={`mt-0.5 ${isIncluded ? (isPro ? 'text-green-400' : 'text-green-600') : (isPro ? 'text-gray-700' : 'text-gray-300')}`}>
                          {isIncluded ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                        </div>
                        <span className={!isIncluded ? (isPro ? 'text-gray-600' : 'text-gray-400') : ''}>{feature.name}</span>
                      </div>
                    );
                  })}
                </div>

                {hasMoreFeatures && (
                  <button
                    onClick={toggleAllCards}
                    className={`mt-6 mb-4 flex items-center justify-center gap-2 text-sm font-medium hover:underline ${isPro ? 'text-gray-300' : 'text-gray-500'}`}
                  >
                    {allExpanded ? (
                      <>Show Less <ChevronUp size={14} /></>
                    ) : (
                      <>View all features <ChevronDown size={14} /></>
                    )}
                  </button>
                )}

                <div className={`mt-8 pt-6 border-t ${isPro ? 'border-gray-800' : 'border-gray-100'}`}>
                  <AuthRedirectButton
                    className={`w-full py-4 h-14 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center shadow-xl ${isPro
                      ? 'bg-white text-black hover:bg-gray-100 shadow-white/5'
                      : 'bg-black text-white hover:bg-gray-800 shadow-black/10'
                      }`}
                  >
                    {plan.buttonText}
                  </AuthRedirectButton>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-32">
          <h2 className="text-4xl font-bold text-center mb-16">Compare features</h2>
          <div className="overflow-x-auto rounded-3xl border border-gray-200 shadow-xl">
            <table className="w-full text-left bg-white">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-6 font-bold text-gray-900 sticky left-0 bg-gray-50">Features</th>
                  <th className="p-6 font-bold text-gray-900 text-center">Free</th>
                  <th className="p-6 font-bold text-gray-900 text-center">Basic</th>
                  <th className="p-6 font-bold text-gray-900 text-center">Pro</th>
                  <th className="p-6 font-bold text-gray-900 text-center">Ultra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonFeatures.map((feature, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="p-6 font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50">{feature.name}</td>
                    <td className="p-6 text-gray-600 text-center text-sm">{typeof (feature as any).free === 'boolean' ? ((feature as any).free ? <Check className="mx-auto text-green-500" size={20} /> : <span className="text-gray-300">—</span>) : (feature as any).free}</td>
                    <td className="p-6 text-gray-600 text-center text-sm">{typeof (feature as any).basic === 'boolean' ? ((feature as any).basic ? <Check className="mx-auto text-green-500" size={20} /> : <span className="text-gray-300">—</span>) : (feature as any).basic}</td>
                    <td className="p-6 text-gray-900 text-center text-sm font-medium bg-gray-50/50">{typeof (feature as any).pro === 'boolean' ? ((feature as any).pro ? <Check className="mx-auto text-green-500" size={20} /> : <span className="text-gray-300">—</span>) : (feature as any).pro}</td>
                    <td className="p-6 text-gray-600 text-center text-sm">{typeof (feature as any).ultra === 'boolean' ? ((feature as any).ultra ? <Check className="mx-auto text-green-500" size={20} /> : <span className="text-gray-300">—</span>) : (feature as any).ultra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingPage;
