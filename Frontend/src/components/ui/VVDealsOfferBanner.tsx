import React from 'react';
import { ArrowRight, Gift, Sparkles, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface VVDealsOfferBannerProps {
  className?: string;
}

const GoogleLogo = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <img
    src="/images/offers/google.png"
    alt="Google Logo"
    loading="lazy"
    className={`${className} object-contain shrink-0`}
    onError={(e) => {
      (e.target as HTMLImageElement).src = '/images/offers/google.svg';
    }}
  />
);

const AmazonPrimeLogo = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <img
    src="/images/offers/amazon-prime.svg"
    alt="Amazon Prime Logo"
    loading="lazy"
    className={`${className} object-contain shrink-0`}
  />
);

const SpotifyLogo = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <img
    src="/images/offers/spotify.png"
    alt="Spotify Logo"
    loading="lazy"
    className={`${className} object-contain shrink-0`}
    onError={(e) => {
      (e.target as HTMLImageElement).src =
        'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a46987b0036306fc8f7/view?project=6a081ab3002501e13f50';
    }}
  />
);

const CapCutLogo = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <img
    src="/images/offers/capcut.png"
    alt="CapCut Pro Logo"
    loading="lazy"
    className={`${className} object-cover rounded-md shrink-0`}
    onError={(e) => {
      (e.target as HTMLImageElement).src =
        'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a670e0c001f7f4c270b/view?project=6a081ab3002501e13f50';
    }}
  />
);

const NetflixLogo = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <img
    src="/images/offers/netflix.png"
    alt="Netflix Logo"
    loading="lazy"
    className={`${className} object-contain shrink-0`}
    onError={(e) => {
      (e.target as HTMLImageElement).src = '/images/offers/netflix.svg';
    }}
  />
);

export const VVDealsOfferBanner: React.FC<VVDealsOfferBannerProps> = ({
  className = ''
}) => {
  const navigate = useNavigate();

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-lg transition-all duration-300 dark:border-white/[0.08] dark:bg-neutral-900/90 ${className}`}
    >
      {/* Header with VVDeals Tag & Redirect to Pricing */}
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-background p-2 shadow-xs dark:border-neutral-700">
            <img
              src="/images/vvdeals-logo.png"
              alt="VVDeals Logo"
              className="h-full w-full object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://vvdeals.cloud/vv-deals-site-icon.png';
              }}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 border border-purple-500/20">
                <Gift className="h-3 w-3 text-pink-500" />
                Ultra Subscription Bonus
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                Partnered with VVDeals
              </span>
            </div>
            <h3 className="mt-1 text-lg font-black tracking-tight text-foreground sm:text-xl">
              Complimentary Entertainment, Music & Cloud Tools on Ultra Plans
            </h3>
          </div>
        </div>

        <Link
          to="/pricing"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-purple-700 active:scale-95 cursor-pointer"
        >
          <span>Explore Pricing & Perks</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Perks Grid - Clicking redirecting to /pricing */}
      <div className="relative z-10 mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Yearly Ultra Perks */}
        <Link
          to="/pricing"
          className="group block rounded-2xl border border-border/80 bg-background/60 p-4 sm:p-5 shadow-xs transition-all hover:border-purple-500/40 hover:bg-background/90"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white text-xs font-black">
                <Star className="h-3.5 w-3.5 fill-current" />
              </span>
              <span className="text-sm font-extrabold text-foreground">
                Ultra Plan • Yearly Subscription
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              18M + 6M + 3M + 1M + 1M
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl bg-card p-2 border border-border/70">
              <GoogleLogo className="h-4 w-4" />
              <div className="min-w-0">
                <p className="font-extrabold text-foreground truncate">18M Google</p>
                <p className="text-[10px] text-muted-foreground truncate">AI Pro & Cloud</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-card p-2 border border-border/70">
              <AmazonPrimeLogo className="h-4 w-4" />
              <div className="min-w-0">
                <p className="font-extrabold text-foreground truncate">6M Prime</p>
                <p className="text-[10px] text-muted-foreground truncate">Video & Delivery</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-card p-2 border border-border/70">
              <SpotifyLogo className="h-4 w-4" />
              <div className="min-w-0">
                <p className="font-extrabold text-foreground truncate">3M Spotify</p>
                <p className="text-[10px] text-muted-foreground truncate">Premium Music</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-card p-2 border border-border/70">
              <CapCutLogo className="h-4 w-4" />
              <div className="min-w-0">
                <p className="font-extrabold text-foreground truncate">1M CapCut</p>
                <p className="text-[10px] text-muted-foreground truncate">Pro Creator</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-card p-2 border border-border/70 sm:col-span-2 md:col-span-1">
              <NetflixLogo className="h-4 w-4" />
              <div className="min-w-0">
                <p className="font-extrabold text-foreground truncate">1M Netflix</p>
                <p className="text-[10px] text-muted-foreground truncate">Premium 4K</p>
              </div>
            </div>
          </div>
        </Link>

        {/* 1-Month Ultra Perks */}
        <Link
          to="/pricing"
          className="group block rounded-2xl border border-border/80 bg-background/60 p-4 sm:p-5 shadow-xs transition-all hover:border-purple-500/40 hover:bg-background/90"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-600 text-white text-xs font-black">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-extrabold text-foreground">
                Ultra Plan • 1-Month Subscription
              </span>
            </div>
            <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-purple-600 dark:text-purple-300 border border-purple-500/30">
              Monthly Bonus
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col items-center justify-center text-center rounded-xl bg-card p-2 border border-border/70">
              <AmazonPrimeLogo className="h-5 w-5 mb-1" />
              <p className="font-extrabold text-foreground leading-tight">1 Month</p>
              <p className="text-[10px] text-muted-foreground truncate">Amazon Prime</p>
            </div>

            <div className="flex flex-col items-center justify-center text-center rounded-xl bg-card p-2 border border-border/70">
              <CapCutLogo className="h-5 w-5 mb-1" />
              <p className="font-extrabold text-foreground leading-tight">7 Days</p>
              <p className="text-[10px] text-muted-foreground truncate">CapCut Pro</p>
            </div>

            <div className="flex flex-col items-center justify-center text-center rounded-xl bg-card p-2 border border-border/70">
              <NetflixLogo className="h-5 w-5 mb-1" />
              <p className="font-extrabold text-foreground leading-tight">5 Days</p>
              <p className="text-[10px] text-muted-foreground truncate">Netflix</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Footer link to pricing */}
      <div className="relative z-10 mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <p>
          * Bonus vouchers and credentials provided via VVDeals upon activation of any eligible Ultra plan subscription.
        </p>
        <Link
          to="/pricing"
          className="font-bold underline text-purple-600 dark:text-purple-400 hover:text-purple-500"
        >
          View all plan pricing & details →
        </Link>
      </div>
    </div>
  );
};

export default VVDealsOfferBanner;
