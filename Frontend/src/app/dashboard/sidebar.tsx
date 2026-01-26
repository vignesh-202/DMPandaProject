import {
  LayoutDashboard,
  MessageSquare,
  Users,
  PlayCircle,
  Tag,
  HelpCircle,
  Mail,
  Settings,
  MessageCircle,
  AlertCircle,
  Film,
  FileText as FileTextIcon,
  Radio,
  BookText,
  AtSign,
  Landmark,
  ChevronUp,
  Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

interface SidebarProps {
  isCollapsed: boolean;
}

const Sidebar = ({ isCollapsed }: SidebarProps) => {
  const { user } = useAuth();
  const { currentView, setCurrentView } = useDashboard();
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <nav className="space-y-2 p-4 flex-1 overflow-y-auto text-black dark:text-white">
        {/* Navigation buttons */}
        <button onClick={() => setCurrentView('Dashboard')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Dashboard' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <LayoutDashboard className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Dashboard</span>}
        </button>
        <button onClick={() => setCurrentView('DM Automation')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'DM Automation' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <MessageSquare className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">DM Automation</span>}
        </button>
        <button onClick={() => setCurrentView('Global Triggers')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Global Triggers' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Globe className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Global Triggers</span>}
        </button>
        <button onClick={() => setCurrentView('Reel Automation')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Reel Automation' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Film className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Reel Automation</span>}
        </button>
        <button onClick={() => setCurrentView('Post Automation')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Post Automation' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <FileTextIcon className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Post Automation</span>}
        </button>
        <button onClick={() => setCurrentView('Story Automation')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Story Automation' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <BookText className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Story Automation</span>}
        </button>
        <button onClick={() => setCurrentView('Live Automation')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Live Automation' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Radio className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Live Automation</span>}
        </button>
        <button onClick={() => setCurrentView('Mentions')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Mentions' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <AtSign className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Mentions</span>}
        </button>
        <button onClick={() => setCurrentView('My Plan')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'My Plan' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <FileTextIcon className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">My Plan</span>}
        </button>
        <button onClick={() => setCurrentView('Transactions')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Transactions' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Landmark className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Transactions</span>}
        </button>
        <button onClick={() => setCurrentView('Pricing')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Pricing' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Tag className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Pricing</span>}
        </button>
        <button onClick={() => setCurrentView('Affiliate & Referral')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Affiliate & Referral' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Users className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Affiliate & Referral</span>}
        </button>
        <button onClick={() => setCurrentView('Watch Video')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Watch Video' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <PlayCircle className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Watch Video</span>}
        </button>
        <button onClick={() => setCurrentView('Support')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Support' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <HelpCircle className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Support</span>}
        </button>
        <button onClick={() => setCurrentView('Contact')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Contact' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Mail className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Contact</span>}
        </button>
        <button onClick={() => setCurrentView('Account Settings')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Account Settings' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <Settings className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Account Settings</span>}
        </button>
        <button onClick={() => setCurrentView('Have feedback?')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Have feedback?' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <MessageCircle className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 whitespace-nowrap">Have feedback?</span>}
        </button>
        <button onClick={() => setCurrentView('Automation Not working?')} className={`flex items-center p-2 rounded-md w-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${currentView === 'Automation Not working?' ? 'bg-black text-white dark:bg-white dark:text-black' : ''} ${isCollapsed ? 'justify-center' : ''}`}>
          <AlertCircle className={`w-5 h-5 ${!isCollapsed && 'mr-2'}`} />
          {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 text-left leading-tight">Automation Not working?</span>}
        </button>
      </nav>

      {/* Sticky Profile Section */}
      {user && (
        <div
          ref={profileMenuRef}
          className="relative p-4 border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
        >
          <div className={`absolute bottom-full left-0 w-full bg-white dark:bg-gray-800 border-t border-r border-l border-gray-200 dark:border-gray-700 rounded-t-lg overflow-hidden transition-all duration-300 ease-in-out ${isProfileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-2">
              <div className="p-2 text-center text-sm text-gray-500 dark:text-gray-400">
                Please upgrade to add new accounts
              </div>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center p-2 rounded-md cursor-not-allowed opacity-50">
                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  {!isCollapsed && <span className="ml-3 text-sm">Dummy Account</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img
                src={user.instagram_profile_pic_url}
                alt="Profile"
                className="w-10 h-10 rounded-full"
              />
              {!isCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-black dark:text-white">{user.instagram_username}</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronUp className={`w-5 h-5 text-black dark:text-white transition-transform duration-300 ${isProfileMenuOpen ? '' : 'rotate-180'}`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
