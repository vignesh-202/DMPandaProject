import React, { useState } from 'react';
import Card from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Instagram, Radio, RefreshCw, Link as LinkIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDashboard } from '../../contexts/DashboardContext';

export interface InstagramStatsData {
  followers: number;
  following: number;
  media_count: number;
  reels_count: number;
  stories_count: number;
  username: string;
  name?: string;
  profile_picture_url: string;
  biography: string;
  website?: string;
  is_live: boolean;
  is_verified?: boolean;
}

// Format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
};

// Stat Item Component
const StatItem = ({ 
  label, 
  value, 
  showExact, 
  onToggle 
}: { 
  label: string; 
  value: number; 
  showExact: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className="flex-1 text-center group/stat cursor-pointer min-w-0 py-1 rounded-lg hover:bg-muted/50 transition-colors"
  >
    <span className="block font-semibold text-foreground text-sm sm:text-base leading-tight transition-all duration-200">
      {showExact ? value.toLocaleString() : formatNumber(value)}
    </span>
    <span className="text-2xs uppercase font-medium tracking-wider text-muted-foreground group-hover/stat:text-primary transition-colors">
      {label}
    </span>
  </button>
);

// Bio Card Component
export const InstagramBioCard: React.FC<{ stats: InstagramStatsData | null; loading: boolean }> = ({ stats, loading }) => {
  const { activeAccount, refreshStats } = useDashboard();
  const [showExact, setShowExact] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (loading && !activeAccount?.profile_picture_url) {
    return (
      <Card className="h-full">
        <div className="flex gap-4">
          <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </Card>
    );
  }

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRefreshing || loading) return;

    setIsRefreshing(true);
    refreshStats();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const profileUrl = stats?.profile_picture_url || activeAccount?.profile_picture_url;
  const hasStories = stats?.stories_count && stats.stories_count > 0;

  return (
    <Card className="relative h-full group">
      {/* Background Decoration */}
      <div className="absolute -right-8 -top-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
        <Instagram className="w-48 h-48 -rotate-12" />
      </div>

      {/* Refresh Button */}
      <button
        onClick={handleRefresh}
        disabled={loading || isRefreshing}
        className={cn(
          "absolute top-3 right-3 p-2 rounded-lg transition-all duration-200 z-10",
          "text-muted-foreground hover:text-primary hover:bg-muted",
          "active:scale-95 disabled:opacity-50",
          (loading || isRefreshing) && "animate-spin text-primary"
        )}
        title="Refresh Stats"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <div className="flex flex-col gap-4 lg:gap-3 relative z-0">
        {/* Top Section: Profile + Info */}
        <div className="flex gap-4">
          {/* Profile Picture - Instagram Story Ring */}
          <div className="flex-shrink-0">
            <div className={cn(
              "p-[2.5px] rounded-full transition-all duration-300 group-hover:scale-105",
              hasStories
                ? "bg-gradient-to-tr from-ig-yellow via-ig-pink to-ig-purple group-hover:shadow-lg group-hover:shadow-primary/30"
                : "bg-border"
            )}>
              <div className="p-[2px] rounded-full bg-card">
                {profileUrl ? (
                  <img
                    src={profileUrl}
                    alt="Profile"
                    className="w-14 h-14 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Instagram className="w-7 h-7 text-primary" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Username & Verified */}
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-semibold text-foreground truncate tracking-tight">
                {stats?.username || activeAccount?.username || "username"}
              </h2>
              {stats?.is_verified && (
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                  ✓
                </div>
              )}
            </div>

            {/* Display Name */}
            {(stats?.name || activeAccount?.name) && (
              <p className="text-xs font-medium text-muted-foreground truncate mb-1">
                {stats?.name || activeAccount?.name}
              </p>
            )}

            {/* Bio */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 max-h-16">
              <p className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-wrap break-words">
                {stats?.biography || "No biography available."}
              </p>
            </div>

            {/* Website */}
            {stats?.website && (
              <a
                href={stats.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover font-medium mt-2 transition-colors group/link"
              >
                <LinkIcon className="w-3.5 h-3.5 flex-shrink-0 group-hover/link:scale-110 transition-transform" />
                <span className="truncate max-w-[200px]">
                  {stats.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </span>
              </a>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="pt-3 lg:pt-2 mt-auto border-t border-border">
          <div className="grid grid-cols-4 gap-1">
            <StatItem 
              label="Posts" 
              value={stats?.media_count || 0} 
              showExact={showExact}
              onToggle={() => setShowExact(!showExact)}
            />
            <StatItem 
              label="Reels" 
              value={stats?.reels_count || 0} 
              showExact={showExact}
              onToggle={() => setShowExact(!showExact)}
            />
            <StatItem 
              label="Followers" 
              value={stats?.followers || 0} 
              showExact={showExact}
              onToggle={() => setShowExact(!showExact)}
            />
            <StatItem 
              label="Following" 
              value={stats?.following || 0} 
              showExact={showExact}
              onToggle={() => setShowExact(!showExact)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

// Live Status Card
export const LiveStatusCard: React.FC<{ stats: InstagramStatsData | null; loading: boolean }> = ({ stats, loading }) => {
  const { setCurrentView } = useDashboard();
  const isLive = !!stats?.is_live;

  return (
    <Card
      variant="interactive"
      padding="none"
      className="relative h-full min-h-[120px] lg:min-h-[92px] flex items-center justify-center"
      onClick={() => setCurrentView('Live Automation')}
    >
      <div className="flex flex-col items-center justify-center gap-3 lg:gap-2 p-4 lg:py-3 lg:px-4">
        {/* Icon with Animation */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          {/* Radio Wave Animations */}
          {(loading || isLive) && (
            <>
              <div 
                className={cn(
                  "absolute inset-0 rounded-full animate-radio-wave opacity-0",
                  loading ? "bg-primary" : "bg-destructive"
                )} 
                style={{ animationDelay: '0s' }} 
              />
              <div 
                className={cn(
                  "absolute inset-2 rounded-full animate-radio-wave opacity-0",
                  loading ? "bg-primary" : "bg-destructive"
                )} 
                style={{ animationDelay: '1s' }} 
              />
            </>
          )}

          {/* Icon Container */}
          <div className={cn(
            "relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
            loading 
              ? "bg-primary shadow-lg shadow-primary/30" 
              : isLive 
                ? "bg-destructive shadow-lg shadow-destructive/30 animate-pulse" 
                : "bg-muted group-hover:scale-110"
          )}>
            <Radio className={cn(
              "w-6 h-6",
              loading || isLive ? "text-white" : "text-muted-foreground"
            )} />
          </div>
        </div>

        {/* Label */}
        <span className={cn(
          "text-sm font-semibold tracking-tight transition-colors",
          loading 
            ? "text-primary" 
            : isLive 
              ? "text-destructive" 
              : "text-muted-foreground"
        )}>
          {loading ? "SCANNING..." : isLive ? "LIVE NOW" : "LIVE AUTOMATION"}
        </span>
      </div>
    </Card>
  );
};

// Stories Card
export const InstagramStoriesCard: React.FC<{ stats: InstagramStatsData | null; loading: boolean }> = ({ stats, loading }) => {
  const { activeAccount, setCurrentView } = useDashboard();
  const storyCount = stats?.stories_count || 0;
  const profileUrl = stats?.profile_picture_url || activeAccount?.profile_picture_url;

  return (
    <Card
      variant="interactive"
      padding="none"
      className="relative h-full min-h-[120px] lg:min-h-[92px] flex items-center justify-center"
      onClick={() => setCurrentView('Story Automation')}
    >
      <div className="flex flex-col items-center justify-center gap-3 lg:gap-2 p-4 lg:py-3 lg:px-4">
        {/* Profile with Story Ring */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          {/* Gradient Animation for Loading */}
          {loading && (
            <div className="absolute inset-0 rounded-full animate-gradient-pulse opacity-70 blur-[2px]" />
          )}

          {/* Profile Container - Instagram Story Ring */}
          <div className={cn(
            "relative z-10 w-12 h-12 rounded-full p-[2px] transition-all duration-300 group-hover:scale-110",
            storyCount > 0 
              ? "bg-gradient-to-tr from-ig-yellow via-ig-pink to-ig-purple group-hover:shadow-lg group-hover:shadow-primary/30" 
              : "bg-border"
          )}>
            <div className="w-full h-full rounded-full bg-card p-[2px] flex items-center justify-center">
              {profileUrl ? (
                <img
                  src={profileUrl}
                  alt="Story Profile"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
                  <Instagram className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Story Count Badge */}
            {!loading && storyCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-2xs font-bold px-1.5 py-0.5 rounded-full border-2 border-card shadow-sm">
                {storyCount}
              </div>
            )}
          </div>
        </div>

        {/* Label */}
        <span className={cn(
          "text-sm font-semibold tracking-tight transition-colors",
          loading 
            ? "text-primary" 
            : storyCount > 0 
              ? "text-primary" 
              : "text-muted-foreground"
        )}>
          {loading ? "FETCHING..." : "STORIES"}
        </span>
      </div>
    </Card>
  );
};

// Main Component
const InstagramStats: React.FC = () => {
  const { activeAccountStats, isLoadingStats } = useDashboard();

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 lg:gap-3">
      {/* Bio Card */}
      <div className="md:col-span-6 lg:col-span-8">
        <InstagramBioCard stats={activeAccountStats} loading={isLoadingStats} />
      </div>

      {/* Status Cards */}
      <div className="md:col-span-6 lg:col-span-4 grid grid-cols-2 gap-4 sm:gap-5">
        <LiveStatusCard stats={activeAccountStats} loading={isLoadingStats} />
        <InstagramStoriesCard stats={activeAccountStats} loading={isLoadingStats} />
      </div>
    </div>
  );
};

export default InstagramStats;
