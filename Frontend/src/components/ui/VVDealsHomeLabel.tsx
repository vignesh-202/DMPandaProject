import React from 'react';
import { ArrowRight, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';

interface VVDealsHomeLabelProps {
  className?: string;
}

export const VVDealsHomeLabel: React.FC<VVDealsHomeLabelProps> = ({ className = '' }) => {
  return (
    <Link
      to="/pricing"
      className={`group relative block overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-card to-card p-6 sm:p-8 lg:p-10 shadow-lg transition-all duration-300 hover:border-purple-500/60 hover:shadow-xl dark:border-purple-500/30 dark:from-purple-950/30 dark:via-neutral-900/90 dark:to-neutral-950 dark:hover:border-purple-500/50 ${className}`}
    >
      {/* Soft background ambient gradient */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-purple-500/20" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-pink-500/20" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
        {/* Left Side: Partner Info & Offer Overview */}
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 min-w-0">
          {/* VVDeals Partner Logo */}
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl border border-purple-500/30 bg-background/90 p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-105 dark:border-neutral-700 dark:bg-neutral-800">
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

          <div className="min-w-0 flex-1">
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 border border-purple-500/30">
                <Gift className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                Ultra Plan Bonus Perks
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                Fulfilled by <strong className="text-foreground">VVDeals.cloud</strong>
              </span>
            </div>

            {/* Main Catchy Heading with Bold Worth */}
            <h3 className="mt-3 text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight leading-snug">
              Get Up to <span className="text-purple-600 dark:text-purple-400">₹39,660</span> in Free Subscriptions with Ultra Plan
            </h3>

            {/* Natural & Clear Description */}
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
              Subscribe to DM Panda Ultra and receive complimentary bonus subscriptions to industry-leading AI, video editing, 4K streaming, and music tools dispatched directly by VV Deals.
            </p>

            {/* Spacious Product Badges with Values */}
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs">
                <img src="/images/offers/google.png" alt="Google" className="h-4 w-4 object-contain" loading="lazy" />
                <span>Google AI Pro (18M)</span>
                <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-black text-purple-700 dark:text-purple-300">₹35,100</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs">
                <img src="/images/offers/amazon-prime.svg" alt="Prime" className="h-4 w-4 object-contain" loading="lazy" />
                <span>Amazon Prime</span>
                <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-black text-cyan-700 dark:text-cyan-300">₹1,794</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs">
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
                <span className="rounded-md bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-black text-pink-700 dark:text-pink-300">₹2,000</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs">
                <img
                  src="/images/offers/spotify.png"
                  alt="Spotify"
                  className="h-4 w-4 object-cover rounded-xs"
                  loading="lazy"
                />
                <span>Spotify Premium</span>
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">₹597</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs">
                <img src="/images/offers/netflix.png" alt="Netflix" className="h-4 w-4 object-contain" loading="lazy" />
                <span>Netflix Premium</span>
                <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">₹169</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Total Worth Callout & CTA Button */}
        <div className="flex flex-col sm:flex-row lg:flex-col shrink-0 items-start sm:items-center lg:items-end gap-3 pt-2 lg:pt-0">
          <div className="text-left lg:text-right">
            <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">₹39,660</span>
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Total Market Worth</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-md shadow-purple-500/25 transition-all duration-300 group-hover:from-purple-700 group-hover:to-indigo-700 group-hover:shadow-lg group-hover:shadow-purple-500/30 group-hover:scale-[1.02]">
            <span>View Perks & Pricing</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
};

export default VVDealsHomeLabel;
