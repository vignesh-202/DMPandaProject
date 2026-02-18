import React, { useEffect, useState } from 'react';
import { Zap, Check, AlertCircle, Calendar } from 'lucide-react';
import { authenticatedFetch } from '../../utils/api';
import PageLoader from '../../components/PageLoader';

interface PlanDetails {
  name: string;
  features: string[];
  price_monthly_inr: number;
  price_monthly_usd: number;
}

interface UserPlan {
  plan_id: string;
  status: string;
  expires: string | null;
  details: PlanDetails | null;
}

const MyPlanView: React.FC = () => {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyPlan = async () => {
      try {
        const response = await authenticatedFetch('/api/my-plan');
        if (response.ok) {
          const data = await response.json();
          setPlan(data);
        }
      } catch (error) {
        console.error('Error fetching plan:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyPlan();
  }, []);

  if (loading) return <PageLoader />;

  const isExpired = plan?.status === 'expired' || (plan?.expires && new Date(plan.expires) < new Date());

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Subscription</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your plan and billing information</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
          <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : 'bg-green-500'}`} />
          {isExpired ? 'Expired' : 'Active'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Current Plan Card */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap size={120} className="text-blue-500" />
          </div>

          <div className="relative">
            <span className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider text-sm">Current Plan</span>
            <h2 className="text-4xl font-black mt-2 mb-6 text-gray-900 dark:text-white flex items-center gap-3">
              {plan?.details?.name || 'Free'}
              <Zap className="fill-blue-500 text-blue-500" size={28} />
            </h2>

            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-600">
                <Calendar size={18} />
                <span className="text-sm">
                  {plan?.expires ? `Renews on ${new Date(plan.expires).toLocaleDateString()}` : 'Never expires'}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="font-bold text-gray-900 dark:text-white">Plan Features:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plan?.details?.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2"
            >
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* Status/Actions Card */}
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-3xl p-6 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-4 text-blue-800 dark:text-blue-300">
              <AlertCircle size={20} />
              <h4 className="font-bold">Need more?</h4>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
              Upgrade to a higher tier to unlock more accounts and automated actions for your growth.
            </p>
          </div>

          <div className="bg-gray-900 text-white rounded-3xl p-6 shadow-xl">
            <h4 className="font-bold mb-2">Usage Summary</h4>
            <div className="space-y-4 mt-6">
              <div>
                <div className="flex justify-between text-xs mb-1 text-gray-400">
                  <span>Daily Actions</span>
                  <span>24/100</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[24%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 text-gray-400">
                  <span>Accounts Connected</span>
                  <span>1/3</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-[33%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPlanView;