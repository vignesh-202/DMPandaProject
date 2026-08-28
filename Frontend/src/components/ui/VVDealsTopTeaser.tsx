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
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-3 sm:p-3.5 shadow-sm transition-all duration-300 hover:border-purple-500/50 hover:shadow-md dark:border-white/[0.08] dark:bg-neutral-900/90 dark:hover:border-purple-500/50 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Left: Clean Brand Avatar Stack + VV Deals Creators Bundle Label */}
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="flex -space-x-1.5 shrink-0 items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background p-1 shadow-xs dark:border-neutral-700">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background p-1 shadow-xs dark:border-neutral-700">
              <img src="/images/offers/google.png" alt="Google AI" className="h-full w-full object-contain" loading="lazy" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background p-1 shadow-xs dark:border-neutral-700">
              <img src="/images/offers/amazon-prime.svg" alt="Amazon Prime" className="h-full w-full object-contain" loading="lazy" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background p-1 shadow-xs dark:border-neutral-700">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background p-0.5 shadow-xs dark:border-neutral-700 overflow-hidden">
              <img
                src="/images/offers/capcut.png"
                alt="CapCut"
                className="h-full w-full object-cover rounded-lg"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a670e0c001f7f4c270b/view?project=6a081ab3002501e13f50';
                }}
              />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background p-1 shadow-xs dark:border-neutral-700">
              <img src="/images/offers/netflix.png" alt="Netflix" className="h-full w-full object-contain" loading="lazy" />
            </div>
          </div>

          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 border border-purple-500/20">
                <Gift className="h-3 w-3 text-pink-500" />
                VV Deals Creators Bundle
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                ₹15,000+ Value Included
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">
              Google AI Pro, Amazon Prime, Spotify, CapCut & Netflix included with Ultra Plan
            </p>
          </div>
        </div>

        {/* Right: Modern Redirect to Pricing */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:text-purple-500 transition-colors">
          <span>Explore Bundle</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
};

export default VVDealsTopTeaser;
