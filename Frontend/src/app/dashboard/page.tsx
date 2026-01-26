import { useState, useEffect } from 'react';
import DashboardLayout from './layout';
import Card from '../../components/ui/card';
import Chart from '../../components/ui/chart';
import AnalyticsChart from '../../components/ui/analytics-chart';
import Gauge from '../../components/ui/gauge';
import { TrendingUp, ArrowRight } from 'lucide-react';
import DashboardLoading from '../../components/ui/DashboardLoading';
import InstagramStats from '../../components/dashboard/InstagramStats';
import { useLoading } from '../../contexts/LoadingContext';

import DMAutomationView from './DMAutomationView';
import GlobalTriggersView from './GlobalTriggersView';
import ReelAutomationView from './ReelAutomationView';
import PostAutomationView from './PostAutomationView';
import StoryAutomationView from './StoryAutomationView';
import LiveAutomationView from './LiveAutomationView';
import MentionsView from './MentionsView';
import MyPlanView from './MyPlanView';
import TransactionsView from './TransactionsView';
import AccountSettingsView from './AccountSettingsView';
import PlaceholderView from './PlaceholderView';
import SupportView from './SupportView';
import AffiliateView from './AffiliateView';
import PricingView from './PricingView';

import { useAuth } from '../../contexts/AuthContext';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';

const DashboardContent = () => {
  const { isLoading: isAuthLoading, hasPassword } = useAuth();
  const { isLoading } = useLoading();
  const { currentView, setCurrentView } = useDashboard();
  const [isAnimationVisible, setIsAnimationVisible] = useState(false);

  useEffect(() => {
    // Set the default view to 'Dashboard' when the component mounts
    setCurrentView('Dashboard');
  }, [setCurrentView]);

  useEffect(() => {
    if (!isLoading && !isAuthLoading && hasPassword) {
      setTimeout(() => {
        setIsAnimationVisible(true);
      }, 500); // Start animation shortly after access is granted
    }
  }, [isLoading, isAuthLoading, hasPassword]);

  // Placeholder data
  const smartScore = 82;
  const followersNumber = 24;
  const reelsNumber = 2986;
  const dmRate = 85;
  const actionsPerMonth = 100;
  const reelCommentReplies = 500;
  const postCommentReplies = 700;

  const totalSalesData = [
    { name: '1', value: 1.1 },
    { name: '5', value: 1.2 },
    { name: '10', value: 1.15 },
    { name: '15', value: 1.3 },
    { name: '20', value: 1.25 },
    { name: '25', value: 1.4 },
    { name: '30', value: 1.35 },
  ];

  const numberOfSalesData = [
    { name: 'Oct', sales: 1.2 },
    { name: 'Sep', sales: 1.5 },
    { name: 'Aug', sales: 1.3 },
    { name: 'Jul', sales: 1.6 },
    { name: 'Jun', sales: 1.4 },
    { name: 'May', sales: 1.7 },
  ];

  const interactionsData = [
    { time: '00:00', interactions: 10 },
    { time: '01:00', interactions: 15 },
    { time: '02:00', interactions: 12 },
    { time: '03:00', interactions: 20 },
    { time: '04:00', interactions: 25 },
    { time: '05:00', interactions: 22 },
    { time: '06:00', interactions: 30 },
    { time: '07:00', interactions: 28 },
    { time: '08:00', interactions: 35 },
    { time: '09:00', interactions: 40 },
    { time: '10:00', interactions: 38 },
    { time: '11:00', interactions: 42 },
    { time: '12:00', interactions: 45 },
    { time: '13:00', interactions: 43 },
    { time: '14:00', interactions: 50 },
    { time: '15:00', interactions: 48 },
    { time: '16:00', interactions: 55 },
    { time: '17:00', interactions: 52 },
    { time: '18:00', interactions: 60 },
    { time: '19:00', interactions: 58 },
    { time: '20:00', interactions: 65 },
    { time: '21:00', interactions: 62 },
    { time: '22:00', interactions: 70 },
    { time: '23:00', interactions: 68 },
  ];

  return (
    <DashboardLayout>
      {isLoading && <DashboardLoading />}
      {currentView === 'Dashboard' && (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4 ${isLoading ? 'blur-sm' : ''}`}>
            <Card>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>Smart score</h3>
              <div className="flex items-center justify-center">
                <Gauge value={smartScore} startAnimation={isAnimationVisible} />
              </div>
              <p className="text-green-500 text-sm mt-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" /> 18 Last week
              </p>
              <a href="#" className="text-blue-500 text-sm mt-1 block flex items-center">Show more <ArrowRight className="w-3 h-3 ml-1" /></a>
            </Card>

            <InstagramStats />

            <Card>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>Reels</h3>
              <div className="text-4xl font-bold mb-2" style={{ color: 'var(--text)' }}>{reelsNumber}</div>
              <p className="text-green-500 text-sm flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" /> 12% Last week
              </p>
              <a href="#" className="text-blue-500 text-sm mt-1 block flex items-center">Show more <ArrowRight className="w-3 h-3 ml-1" /></a>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>DM Rate</h3>
              <div className="flex items-center justify-center">
                <Gauge value={dmRate} max={100} startAnimation={isAnimationVisible} invertColor={true} />
              </div>
              <p className="text-lg font-bold text-center mt-2" style={{ color: 'var(--text)' }}>{dmRate} DMs/hr</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <Card>
              <h3 className="text-lg font-semibold mb-2 text-center" style={{ color: 'var(--text)' }}>Action's per month</h3>
              <div className="flex justify-center">
                <Gauge value={actionsPerMonth} max={2000} startAnimation={isAnimationVisible} invertColor={true} />
              </div>
              <p className="text-lg font-bold text-center mt-2" style={{ color: 'var(--text)' }}>{actionsPerMonth}</p>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold mb-2 text-center" style={{ color: 'var(--text)' }}>Reel comment replies</h3>
              <div className="flex justify-center">
                <Gauge value={reelCommentReplies} max={1000} startAnimation={isAnimationVisible} invertColor={true} />
              </div>
              <p className="text-lg font-bold text-center mt-2" style={{ color: 'var(--text)' }}>{reelCommentReplies}</p>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold mb-2 text-center" style={{ color: 'var(--text)' }}>Post comment replies</h3>
              <div className="flex justify-center">
                <Gauge value={postCommentReplies} max={1000} startAnimation={isAnimationVisible} invertColor={true} />
              </div>
              <p className="text-lg font-bold text-center mt-2" style={{ color: 'var(--text)' }}>{postCommentReplies}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>Total Sales</h3>
              <div className="flex justify-between items-center mb-4">
                <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>$1,652,850</p>
                <select className="border rounded-md p-2 bg-white dark:bg-gray-800 text-black dark:text-white dark:border-gray-700 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                  <option>Month</option>
                  <option>Quarter</option>
                  <option>Year</option>
                </select>
              </div>
              <Chart data={totalSalesData} type="line" dataKey="value" xAxisKey="name" lineColor="black" hideYAxis hideLegend />
            </Card>
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>Followers</h3>
              <p className="text-3xl font-bold mb-4" style={{ color: 'var(--text)' }}>{followersNumber}</p>
              <Chart data={numberOfSalesData} type="bar" dataKey="sales" xAxisKey="name" barColor="black" />
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>No of interactions with time in last 24 hours</h3>
              <Chart data={interactionsData} type="line" dataKey="interactions" xAxisKey="time" lineColor="black" />
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>Analytics Overview</h3>
              <AnalyticsChart
                data={totalSalesData}
                type="bar"
                dataKey="value"
                xAxisKey="name"
                barColor="black"
              />
            </Card>
          </div>
        </>
      )}
      {currentView === 'DM Automation' && <DMAutomationView />}
      {currentView === 'Global Triggers' && <GlobalTriggersView />}
      {currentView === 'Reel Automation' && <ReelAutomationView />}
      {currentView === 'Post Automation' && <PostAutomationView />}
      {currentView === 'Story Automation' && <StoryAutomationView />}
      {currentView === 'Live Automation' && <LiveAutomationView />}
      {currentView === 'Mentions' && <MentionsView />}
      {currentView === 'My Plan' && <MyPlanView />}
      {currentView === 'Transactions' && <TransactionsView />}
      {currentView === 'Account Settings' && <AccountSettingsView />}
      {currentView === 'Pricing' && <PricingView />}
      {currentView === 'Affiliate & Referral' && <AffiliateView />}
      {currentView === 'Watch Video' && <PlaceholderView title="Watch Video" />}
      {currentView === 'Support' && <SupportView />}
      {currentView === 'Contact' && <PlaceholderView title="Contact" />}
      {currentView === 'Have feedback?' && <PlaceholderView title="Have feedback?" />}
      {currentView === 'Automation Not working?' && <PlaceholderView title="Automation Not working?" />}
    </DashboardLayout>
  );
};

const DashboardPage = () => (
  <DashboardProvider>
    <DashboardContent />
  </DashboardProvider>
);

export default DashboardPage;
