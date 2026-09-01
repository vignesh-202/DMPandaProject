import React from 'react';
import { ArrowRight, Gift } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface VVDealsTopTeaserProps {
  className?: string;
  onExploreClick?: () => void;
}

export const VVDealsTopTeaser: React.FC<VVDealsTopTeaserProps> = ({
  className = '',
  onExploreClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAction = () => {
    if (onExploreClick) {
      onExploreClick();
      return;
    }
    if (location.pathname === '/pricing') {
      const target = document.getElementById('vvdeals-offer-details');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    navigate('/pricing');
  };

  return (
    <div
      onClick={handleAction}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAction();
        }
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl sm:rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-500/[0.06] via-card to-card p-4 sm:p-6 shadow-sm transition-all duration-300 hover:border-purple-500/60 hover:shadow-md dark:border-purple-500/25 dark:from-purple-950/20 dark:via-neutral-900/90 dark:to-neutral-950 ${className}`}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
        {/* Left Side: Brand Stack + Clear Description */}
        <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3.5 sm:gap-5 w-full md:w-auto min-w-0 text-center sm:text-left">
          {/* Logo Stack */}
          <div className="flex -space-x-2 shrink-0 items-center">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-background p-1.5 shadow-2xs dark:border-neutral-700">
              <img
                src="/images/vvdeals-logo.png"
                alt="VV Deals"
                className="h-full w-full object-contain"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://vvdeals.cloud/vv-deals-site-icon.png';
                }}
              />
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-background p-1.5 shadow-2xs dark:border-neutral-700">
              <img src="/images/offers/google.png" alt="Google AI" className="h-full w-full object-contain" loading="lazy" />
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-background p-1.5 shadow-2xs dark:border-neutral-700">
              <img src="/images/offers/amazon-prime.svg" alt="Amazon Prime" className="h-full w-full object-contain" loading="lazy" />
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-background p-1.5 shadow-2xs dark:border-neutral-700">
              <img
                src="/images/offers/spotify.png"
                alt="Spotify"
                className="h-full w-full object-contain"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a46987b0036306fc8f7/view?project=6a081ab3002501e13f50';
                }}
              />
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-background p-1 shadow-2xs dark:border-neutral-700 overflow-hidden">
              <img
                src="/images/offers/capcut.png"
                alt="CapCut"
                className="h-full w-full object-cover rounded-md"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a670e0c001f7f4c270b/view?project=6a081ab3002501e13f50';
                }}
              />
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-background p-1.5 shadow-2xs dark:border-neutral-700">
              <img src="/images/offers/netflix.png" alt="Netflix" className="h-full w-full object-contain" loading="lazy" />
            </div>
          </div>

          {/* Text Information */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 border border-purple-500/30">
                <Gift className="h-3 w-3 text-pink-500" />
                Ultra Plan Bonus Perks
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                Provided by <strong className="text-foreground">VVDeals.cloud</strong>
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-foreground mt-1">
              Google AI Pro, Amazon Prime, Spotify, CapCut & Netflix included with Ultra subscription
            </p>
          </div>
        </div>

        {/* Right Side: Simple Clean Action */}
        <div className="flex items-center gap-2 shrink-0 text-xs sm:text-sm font-bold text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
          <span>View Included Perks</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
};

export default VVDealsTopTeaser;
