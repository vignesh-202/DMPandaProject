import React, { useState, useEffect } from 'react';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';
import { ChevronDown, ChevronUp } from 'lucide-react';

const PricingPage: React.FC = () => {
  const [isYearly, setIsYearly] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [isIndianUser, setIsIndianUser] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  useEffect(() => {
    const fetchCountry = async () => {
      try {
        const response = await fetch('http://ip-api.com/json');
        const data = await response.json();
        if (data.countryCode === 'IN') {
          setIsIndianUser(true);
          setCurrency('INR');
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
        { name: '1 Instagram connection', included: true },
        { name: '100 actions/day', included: true },
        { name: '1,000 actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: 'Last 5 posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Share reel to DM', included: false },
        { name: 'Share post to DM', included: false },
        { name: 'Automated reply for DM\'S with keywords', included: false },
        { name: 'Customised DM\'s for story mentions', included: false },
        { name: 'Button template for Links', included: false },
        { name: 'Instagram Live Automation', included: false },
        { name: 'Webhook integrations', included: false },
        { name: 'Priority support', included: false },
        { name: 'Followers Only', included: false },
        { name: 'Giveaway for Followers', included: false },
        { name: 'Dedicated Account Manager', included: false },
        { name: 'No Watermark', included: false },
      ],
      buttonText: 'Get Started',
      visibleFeatures: 5,
    },
    {
      name: 'Basic',
      price: { monthly: 599, yearly: 499 },
      features: [
        { name: '3 Instagram connection', included: true },
        { name: '100 actions/hour [varies for type of action]', included: true },
        { name: '30,000 actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: '15 posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Share reel to DM', included: true },
        { name: 'Share post to DM', included: true },
        { name: 'Automated reply for DM\'S with keywords', included: false },
        { name: 'Customised DM\'s for story mentions', included: false },
        { name: 'Button template for Links', included: false },
        { name: 'Instagram Live Automation', included: false },
        { name: 'Webhook integrations', included: false },
        { name: 'Priority support', included: false },
        { name: 'Followers Only', included: false },
        { name: 'Giveaway for Followers', included: false },
        { name: 'Dedicated Account Manager', included: false },
        { name: 'No Watermark', included: true },
      ],
      buttonText: 'Choose Plan',
      visibleFeatures: 5,
    },
    {
      name: 'Pro',
      price: { monthly: 999, yearly: 799 },
      popular: true,
      yearlyBonus: '+ 2 months free',
      features: [
        { name: '5 Instagram connection', included: true },
        { name: '300 actions/hour [varies for type of action]', included: true },
        { name: 'Unlimited actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: 'Unlimited posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Share reel to DM', included: true },
        { name: 'Share post to DM', included: true },
        { name: 'Automated reply for DM\'S with keywords', included: true },
        { name: 'Customised DM\'s for story mentions', included: true },
        { name: 'Button template for Links', included: true },
        { name: 'Instagram Live Automation', included: true },
        { name: 'Webhook integrations', included: true },
        { name: 'Priority support', included: true },
        { name: 'Followers Only', included: true },
        { name: 'Giveaway for Followers', included: true },
        { name: 'Dedicated Account Manager', included: false, yearly: true },
        { name: 'No Watermark', included: true },
      ],
      buttonText: 'Choose Plan',
      visibleFeatures: 5,
    },
    {
      name: 'Ultra',
      price: { monthly: 1999, yearly: 1599 },
      yearlyBonus: '+ 3 months free',
      features: [
        { name: '10 Instagram connections', included: true },
        { name: '500 actions/hour [varies for type of action]', included: true },
        { name: 'Unlimited actions/month', included: true },
        { name: 'Unlimited Contacts', included: true },
        { name: 'Unlimited posts/reels', included: true },
        { name: 'Reel comment reply automation', included: true },
        { name: 'Post comment reply automation', included: true },
        { name: 'Share reel to DM', included: true },
        { name: 'Share post to DM', included: true },
        { name: 'Automated reply for DM\'S with keywords', included: true },
        { name: 'Customised DM\'s for story mentions', included: true },
        { name: 'Button template for Links', included: true },
        { name: 'Instagram Live Automation', included: true },
        { name: 'Webhook integrations', included: true },
        { name: 'Priority support', included: true },
        { name: 'Followers Only', included: true },
        { name: 'Giveaway for Followers', included: true },
        { name: 'Dedicated Account Manager', included: true },
        { name: 'No Watermark', included: true },
      ],
      buttonText: 'Choose Plan',
      visibleFeatures: 5,
    },
    {
      name: 'Enterprise',
      price: { custom: true },
      features: [
        { name: 'Custom Integrations', included: true },
        { name: 'Dedicated Account Manager', included: true },
        { name: 'Custom Automation Rules', included: true },
        { name: 'SLA & Premium Support', included: true },
        { name: 'Unlimited Instagram connections', included: true },
        { name: 'White-label solution', included: true },
      ],
      buttonText: 'Contact Us',
      visibleFeatures: 4,
    },
  ];

  const comparisonFeatures = [
    { name: 'Instagram Connections', free: '1', basic: '3', pro: '5', ultra: '10', enterprise: 'Custom' },
    { name: 'Actions/Day', free: '100', basic: '100/hour', pro: '300/hour', ultra: '500/hour', enterprise: 'Custom' },
    { name: 'Actions/Month', free: '1,000', basic: '30,000', pro: 'Unlimited', ultra: 'Unlimited', enterprise: 'Custom' },
    { name: 'Content Automations', free: 'Last 5 Posts/Reels', basic: '15 Posts/Reels', pro: 'Unlimited', ultra: 'Unlimited', enterprise: 'Custom' },
    { name: 'Unlimited Contacts', free: true, basic: true, pro: true, ultra: true, enterprise: true },
    { name: 'Reel Comment Reply Automation', free: true, basic: true, pro: true, ultra: true, enterprise: true },
    { name: 'Post Comment Reply Automation', free: true, basic: true, pro: true, ultra: true, enterprise: true },
    { name: 'Share Reel to DM', free: false, basic: true, pro: true, ultra: true, enterprise: true },
    { name: 'Share Post to DM', free: false, basic: true, pro: true, ultra: true, enterprise: true },
    { name: 'Automated DM Replies with Keywords', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Customised DMs for Story Mentions', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Button Template for Links', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Instagram Live Automation', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Webhook Integrations', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Priority Support', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Followers Only', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Giveaway for Followers', free: false, basic: false, pro: true, ultra: true, enterprise: true },
    { name: 'Dedicated Account Manager', free: false, basic: false, pro: '✓ (Only on Yearly)', ultra: true, enterprise: true },
    { name: 'No Watermark', free: false, basic: true, pro: true, ultra: true, enterprise: true },
  ];

  return (
    <section className="pricing-section py-12 bg-white text-gray-900">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-black">Flexible Pricing for Everyone</h2>
          <p className="text-lg sm:text-xl text-gray-600 mt-4">Choose the plan that's right for you. No hidden fees.</p>
        </div>

        <div className="flex flex-col items-center mb-12 space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 w-auto">
            <span className={`text-lg font-medium justify-self-end ${!isYearly ? 'text-black' : 'text-gray-500'}`}>Monthly</span>
            <label className="relative inline-block w-14 h-8">
              <input type="checkbox" checked={isYearly} onChange={handleToggle} className="opacity-0 w-0 h-0" />
              <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-200 rounded-full transition-colors duration-300 ease-in-out"></span>
              <span className={`absolute cursor-pointer top-1 left-1 w-6 h-6 bg-black rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${isYearly ? 'translate-x-6' : ''}`}></span>
            </label>
            <span className={`text-lg font-medium justify-self-start ${isYearly ? 'text-black' : 'text-gray-500'}`}>Yearly (Save 20%)</span>
          </div>
          {isIndianUser && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 w-auto">
              <span className={`text-lg font-medium justify-self-end ${currency === 'INR' ? 'text-black' : 'text-gray-500'}`}>INR</span>
              <label className="relative inline-block w-14 h-8">
                <input type="checkbox" checked={currency === 'USD'} onChange={handleCurrencyToggle} className="opacity-0 w-0 h-0" />
                <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-200 rounded-full transition-colors duration-300 ease-in-out"></span>
                <span className={`absolute cursor-pointer top-1 left-1 w-6 h-6 bg-black rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${currency === 'USD' ? 'translate-x-6' : ''}`}></span>
              </label>
              <span className={`text-lg font-medium justify-self-start ${currency === 'USD' ? 'text-black' : 'text-gray-500'}`}>USD</span>
            </div>
          )}
        </div>
        <p className="text-center text-gray-600 text-sm mb-12">
          For users in India, prices are displayed in INR. For all other users, prices are in USD due to exchange rates and payment gateway charges.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {plans.map((plan, index) => {
            const visibleFeatures = allExpanded ? plan.features : plan.features.slice(0, plan.visibleFeatures);
            const hasMoreFeatures = plan.features.length > plan.visibleFeatures;

            return (
              <div
                key={index}
                className={`card pricing-card text-center flex flex-col shadow-lg rounded-2xl bg-gray-50 transform transition-all duration-300 hover:shadow-2xl ${plan.popular ? 'border-4 border-black scale-105' : 'border-2 border-gray-200'}`}
              >
                {plan.popular && (
                  <div className="bg-black text-white text-xs font-bold uppercase py-2 px-4 rounded-t-xl -mt-px">
                    Most Popular
                  </div>
                )}
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-2xl font-bold mb-3 text-black">{plan.name}</h3>
                  <div className="price mb-4">
                    {plan.price.custom ? (
                      <span className="text-3xl font-bold text-black">Custom</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-black">
                          {currency === 'INR' ? '₹' : '$'}
                          {currency === 'INR'
                            ? isYearly
                              ? plan.price.yearly
                              : plan.price.monthly
                            : isYearly
                              ? convertToUSD(plan.price.yearly ?? 0, plan.name, true)
                              : convertToUSD(plan.price.monthly ?? 0, plan.name, false)}
                        </span>
                        <span className="text-gray-600 text-sm">/month</span>
                      </>
                    )}
                    {isYearly && plan.yearlyBonus && (
                      <p className="text-green-600 font-semibold text-sm mt-1">{plan.yearlyBonus}</p>
                    )}
                  </div>
                  <ul className="text-left space-y-2 mb-4 text-gray-600 flex-grow text-sm">
                    {visibleFeatures.map((feature, i) => {
                      let isIncluded = feature.included;
                      if ('yearly' in feature && feature.yearly) {
                        isIncluded = isYearly;
                      }
                      if (plan.name === 'Pro' && feature.name === 'Dedicated Account Manager' && !isYearly) {
                        isIncluded = false;
                      }
                      return (
                        <li key={i} className="flex items-start">
                          <span className={`mr-2 text-lg flex-shrink-0 ${isIncluded ? 'text-green-500' : 'text-red-400'}`}>
                            {isIncluded ? '✓' : '−'}
                          </span>
                          <span className="text-xs">{feature.name}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {hasMoreFeatures && (
                    <button
                      onClick={toggleAllCards}
                      className="flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4 transition-colors"
                    >
                      {allExpanded ? (
                        <>
                          <span>Show Less</span>
                          <ChevronUp size={16} />
                        </>
                      ) : (
                        <>
                          <span>Read More</span>
                          <ChevronDown size={16} />
                        </>
                      )}
                    </button>
                  )}
                  <AuthRedirectButton
                    className={`btn mt-auto font-bold py-3 px-6 rounded-full transition-all duration-300 ease-in-out w-full text-sm ${plan.popular ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black border-2 border-black hover:bg-black hover:text-white'}`}
                  >
                    {plan.buttonText}
                  </AuthRedirectButton>
                </div>
              </div>
            );
          })}
        </div>

        <div className="comparison-table mt-20 pt-10 border-t border-gray-200">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-black">Full Plan Comparison</h2>
            <p className="text-xl sm:text-2xl text-gray-600 mt-4">Find the perfect plan for your needs.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left bg-white shadow-lg rounded-lg">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-4 text-sm font-semibold text-black">Feature</th>
                  <th className="p-4 text-sm font-semibold text-black">Free</th>
                  <th className="p-4 text-sm font-semibold text-black">Basic</th>
                  <th className="p-4 text-sm font-semibold text-black">Pro</th>
                  <th className="p-4 text-sm font-semibold text-black">Ultra</th>
                  <th className="p-4 text-sm font-semibold text-black">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, index) => (
                  <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800 text-sm">{feature.name}</td>
                    <td className="p-4 text-gray-600 text-sm">{typeof feature.free === 'boolean' ? (feature.free ? '✓' : '−') : feature.free}</td>
                    <td className="p-4 text-gray-600 text-sm">{typeof feature.basic === 'boolean' ? (feature.basic ? '✓' : '−') : feature.basic}</td>
                    <td className="p-4 text-gray-600 text-sm">{typeof feature.pro === 'boolean' ? (feature.pro ? '✓' : '−') : feature.pro}</td>
                    <td className="p-4 text-gray-600 text-sm">{typeof feature.ultra === 'boolean' ? (feature.ultra ? '✓' : '−') : feature.ultra}</td>
                    <td className="p-4 text-gray-600 text-sm">{typeof feature.enterprise === 'boolean' ? (feature.enterprise ? '✓' : '−') : feature.enterprise}</td>
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
