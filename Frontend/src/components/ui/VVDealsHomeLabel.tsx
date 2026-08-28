import React from 'react';
import { ArrowRight, Gift, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

interface VVDealsHomeLabelProps {
  className?: string;
}

export const VVDealsHomeLabel: React.FC<VVDealsHomeLabelProps> = ({ className = '' }) => {
  return (
    <Link
      to="/pricing"
      className={`group relative flex flex-col md:flex-row items-center justify-between gap-5 rounded-3xl border border-border/80 bg-card/95 p-5 sm:p-6 shadow-md transition-all duration-300 hover:border-purple-500/50 hover:shadow-xl dark:border-white/[0.08] dark:bg-neutral-900/90 dark:hover:border-purple-500/50 ${className}`}
    >
      {/* Left: Brand Logos & Comprehensive Description */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left min-w-0">
        {/* VVDeals Partner Logo Badge */}
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-background p-2 shadow-xs dark:border-neutral-700">
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

        <div className="min-w-0">
          {/* Tag & Partner Badge */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 border border-purple-500/20">
              <Gift className="h-3.5 w-3.5 text-pink-500" />
              VV Deals Creators Bundle
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              Official Partner • <span className="font-bold text-foreground">VVDeals.cloud</span>
            </span>
          </div>

          {/* Heading */}
          <h3 className="mt-1.5 text-base sm:text-lg lg:text-xl font-black text-foreground tracking-tight">
            Complimentary Premium Tools Included with DM Panda Ultra Plan
          </h3>

          {/* Clean Description with Perks Breakdown */}
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
            Upgrade to the Ultra Plan and get free access to <strong className="text-foreground">Google AI Pro (18 Months)</strong>, <strong className="text-foreground">Amazon Prime (6 Months)</strong>, <strong className="text-foreground">Spotify Premium (3 Months)</strong>, <strong className="text-foreground">CapCut Pro</strong>, and <strong className="text-foreground">Netflix</strong>.
          </p>

          {/* Overlapping Brand Icon Badges */}
          <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
              <img src="/images/offers/google.png" alt="Google" className="h-4 w-4 object-contain" loading="lazy" />
              <span>Google AI Pro</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
              <img src="/images/offers/amazon-prime.svg" alt="Prime" className="h-4 w-4 object-contain" loading="lazy" />
              <span>Amazon Prime</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
              <img
                src="/images/offers/spotify.png"
                alt="Spotify"
                className="h-4 w-4 object-contain"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a46987b0036306fc8f7/view?project=6a081ab3002501e13f50';
                }}
              />
              <span>Spotify Premium</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
              <img
                src="/images/offers/capcut.png"
                alt="CapCut"
                className="h-4 w-4 object-cover rounded-sm"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a670e0c001f7f4c270b/view?project=6a081ab3002501e13f50';
                }}
              />
              <span>CapCut Pro</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
              <img src="/images/offers/netflix.png" alt="Netflix" className="h-4 w-4 object-contain" loading="lazy" />
              <span>Netflix</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Modern Action Button */}
      <div className="flex shrink-0 items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-md shadow-purple-500/25 transition-all duration-300 group-hover:bg-purple-700 group-hover:scale-105">
          <span>Explore Pricing & Bundle</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
};

export default VVDealsHomeLabel;
