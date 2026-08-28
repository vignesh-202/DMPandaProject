import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gift,
  HelpCircle,
  ShieldAlert,
  Sparkles,
  Star,
  CheckCircle2,
  Flame
} from 'lucide-react';

/* =========================================================
   REAL BRAND IMAGE LOGOS
   ========================================================= */

const GoogleLogo = ({ className = 'h-7 w-7' }: { className?: string }) => (
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

const AmazonPrimeLogo = ({ className = 'h-7 w-7' }: { className?: string }) => (
  <img
    src="/images/offers/amazon-prime.svg"
    alt="Amazon Prime Logo"
    loading="lazy"
    className={`${className} object-contain shrink-0`}
  />
);

const SpotifyLogo = ({ className = 'h-7 w-7' }: { className?: string }) => (
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

const CapCutLogo = ({ className = 'h-7 w-7' }: { className?: string }) => (
  <img
    src="/images/offers/capcut.png"
    alt="CapCut Pro Logo"
    loading="lazy"
    className={`${className} object-cover rounded-lg shrink-0`}
    onError={(e) => {
      (e.target as HTMLImageElement).src =
        'https://appwrite.vvdeals.cloud/v1/storage/buckets/product-images/files/6a670e0c001f7f4c270b/view?project=6a081ab3002501e13f50';
    }}
  />
);

const NetflixLogo = ({ className = 'h-7 w-7' }: { className?: string }) => (
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

interface OfferFAQ {
  question: string;
  answer: string;
}

const OFFER_FAQS: OfferFAQ[] = [
  {
    question: 'How do I claim my bonus Google AI, Amazon Prime, Spotify, CapCut, and Netflix perks?',
    answer:
      'Once you subscribe to an eligible DM Panda Ultra plan (either Monthly or Yearly), your transaction invoice is generated. You can activate your vouchers or credentials directly through our partner VVDeals by visiting https://vvdeals.cloud/ or contacting support@vvdeals.cloud with your DM Panda payment reference ID.'
  },
  {
    question: 'What exact VVDeals products are bundled with Ultra plans?',
    answer:
      'Ultra Yearly includes: Google AI Pro 18 Months (https://vvdeals.cloud/product/google-ai-pro-18-months), Amazon Prime Subscription 6 Months on your email (https://vvdeals.cloud/product/amazon-prime-subscription-6-months-on-your-email), Spotify Premium Individual 3 Months (https://vvdeals.cloud/product/spotify-premium-individual-3-months), CapCut Pro 1 Month (https://vvdeals.cloud/product/capcut-pro-1-month), and Netflix Premium 1 Month 1-Device Access (https://vvdeals.cloud/product/netflix-premium-1-month-1-device-access). Ultra 1-Month includes: Amazon Prime 1 Month (https://vvdeals.cloud/product/amazon-prime-subscription-1-month-on-your-mail), CapCut Pro 7 Days (https://vvdeals.cloud/product/capcut-pro-7-days), and Netflix Premium 5 Days Access (https://vvdeals.cloud/product/netflix-premium-5-days-access).'
  },
  {
    question: 'How are the credentials or vouchers delivered?',
    answer:
      'Digital vouchers, account invites, or redemption keys are dispatched electronically via VVDeals within 24–48 hours of verified payment.'
  },
  {
    question: 'Can I claim the offer multiple times if I upgrade multiple Instagram accounts?',
    answer:
      'Yes, each individual Ultra plan subscription activated on a linked Instagram account qualifies for its respective VVDeals promotional bonus bundle.'
  },
  {
    question: 'Who provides technical support and warranty for the bonus subscriptions?',
    answer:
      'All warranty coverage, replacement requests, login assistance, and subscription renewals for external services (Google, Amazon, Spotify, CapCut, Netflix) are exclusively handled by VVDeals. DM Panda provides the Instagram automation software only and is not responsible for external third-party streaming or cloud infrastructure.'
  }
];

export const VVDealsOfferSection: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((current) => (current === index ? null : index));
  };

  return (
    <section
      id="vvdeals-offer-details"
      className={`relative scroll-mt-24 overflow-hidden rounded-[2.5rem] border border-purple-500/30 bg-gradient-to-b from-purple-950/20 via-card to-card p-6 sm:p-10 lg:p-12 shadow-2xl backdrop-blur-xl ${className}`}
    >
      {/* Decorative ambient glows */}
      <div className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-pink-500/10 blur-3xl" />

      {/* Header Badge & Title */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/15 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 shadow-sm">
          <Flame className="h-4 w-4 text-pink-500" />
          <span>VV Deals Creators Bundle</span>
        </div>

        <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-foreground">
          VV Deals Creators Bundle Powered by{' '}
          <a
            href="https://vvdeals.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent underline decoration-purple-500/40 hover:opacity-90"
          >
            VVDeals
          </a>
        </h2>

        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Upgrade your Instagram automation to the <strong className="text-foreground">Ultra Plan</strong> and unlock the <strong className="text-foreground">VV Deals Creators Bundle</strong> with complimentary access to premium AI, entertainment, music, video editing, and cloud tools.
        </p>

        {/* Real Brand Logos Showcase Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
          <a
            href="https://vvdeals.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-card/90 px-3.5 py-2 shadow-xs transition-all hover:scale-105 hover:border-purple-500"
            title="Visit VVDeals Cloud"
          >
            <img
              src="/images/vvdeals-logo.png"
              alt="VVDeals"
              className="h-5 w-5 object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://vvdeals.cloud/vv-deals-site-icon.png';
              }}
            />
            <span className="text-xs font-black text-foreground">VVDeals.cloud</span>
          </a>

          <a
            href="https://vvdeals.cloud/product/google-ai-pro-18-months"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-3.5 py-2 shadow-xs transition-all hover:scale-105 hover:border-blue-400"
            title="View Google AI Pro 18 Months on VVDeals"
          >
            <GoogleLogo className="h-5 w-5" />
            <span className="text-xs font-bold text-foreground">Google AI Pro</span>
          </a>

          <a
            href="https://vvdeals.cloud/product/amazon-prime-subscription-6-months-on-your-email"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-3.5 py-2 shadow-xs transition-all hover:scale-105 hover:border-cyan-400"
            title="View Amazon Prime on VVDeals"
          >
            <AmazonPrimeLogo className="h-5 w-5" />
            <span className="text-xs font-bold text-foreground">Amazon Prime</span>
          </a>

          <a
            href="https://vvdeals.cloud/product/spotify-premium-individual-3-months"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-3.5 py-2 shadow-xs transition-all hover:scale-105 hover:border-emerald-400"
            title="View Spotify Premium on VVDeals"
          >
            <SpotifyLogo className="h-5 w-5" />
            <span className="text-xs font-bold text-foreground">Spotify Premium</span>
          </a>

          <a
            href="https://vvdeals.cloud/product/capcut-pro-1-month"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-3.5 py-2 shadow-xs transition-all hover:scale-105 hover:border-pink-400"
            title="View CapCut Pro on VVDeals"
          >
            <CapCutLogo className="h-5 w-5" />
            <span className="text-xs font-bold text-foreground">CapCut Pro</span>
          </a>

          <a
            href="https://vvdeals.cloud/product/netflix-premium-1-month-1-device-access"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-3.5 py-2 shadow-xs transition-all hover:scale-105 hover:border-red-500"
            title="View Netflix Premium on VVDeals"
          >
            <NetflixLogo className="h-5 w-5" />
            <span className="text-xs font-bold text-foreground">Netflix Premium</span>
          </a>
        </div>
      </div>

      {/* Side-by-Side Detailed Breakdown Cards with direct simple modern product links */}
      <div className="relative z-10 mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tier 1: Ultra Yearly Plan Bundle (5 Perks) */}
        <div className="relative flex flex-col justify-between rounded-3xl border-2 border-purple-500/40 bg-gradient-to-b from-purple-950/20 via-card to-card p-6 sm:p-8 shadow-xl">
          <div className="absolute -top-3.5 left-6 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 px-4 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-md">
            ★ Highest Value Bundle
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-foreground">Ultra Yearly Plan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Annual Instagram Automation Subscription</p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                18M + 6M + 3M + 1M + 1M
              </span>
            </div>

            <div className="mt-6 space-y-3.5">
              {/* Google AI Pro 18 Months */}
              <a
                href="https://vvdeals.cloud/product/google-ai-pro-18-months"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-2 group-hover:scale-105 transition-transform">
                    <GoogleLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      Google AI Pro (18 Months)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      18 Months Gemini Pro AI and expanded cloud storage.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>

              {/* Amazon Prime 6 Months */}
              <a
                href="https://vvdeals.cloud/product/amazon-prime-subscription-6-months-on-your-email"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-2 group-hover:scale-105 transition-transform">
                    <AmazonPrimeLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      Amazon Prime (6 Months)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      6 Months Prime Video, deals, and free delivery on your email.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>

              {/* Spotify Premium 3 Months */}
              <a
                href="https://vvdeals.cloud/product/spotify-premium-individual-3-months"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-2 group-hover:scale-105 transition-transform">
                    <SpotifyLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      Spotify Premium (3 Months)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      3 Months ad-free music, offline downloads, and high fidelity.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>

              {/* CapCut Pro 1 Month */}
              <a
                href="https://vvdeals.cloud/product/capcut-pro-1-month"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-1.5 group-hover:scale-105 transition-transform overflow-hidden">
                    <CapCutLogo className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      CapCut Pro (1 Month)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      1 Month creator transitions, AI effects, and 4K export.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>

              {/* Netflix Premium 1 Month */}
              <a
                href="https://vvdeals.cloud/product/netflix-premium-1-month-1-device-access"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-2 group-hover:scale-105 transition-transform">
                    <NetflixLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      Netflix Premium (1 Month)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      1 Month 1-device Ultra HD 4K streaming access.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4 text-xs font-semibold text-muted-foreground">
            ⚡ Automatically eligible upon activating the Ultra Plan (Yearly cycle).
          </div>
        </div>

        {/* Tier 2: Ultra 1-Month Plan Bundle (3 Perks) */}
        <div className="relative flex flex-col justify-between rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-lg">
          <div className="absolute -top-3.5 left-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-sm">
            Monthly Flexibility
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-foreground">Ultra 1-Month Plan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Monthly Instagram Automation Subscription</p>
              </div>
              <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-black text-purple-600 dark:text-purple-300 border border-purple-500/30">
                1M + 7D + 5D
              </span>
            </div>

            <div className="mt-6 space-y-3.5">
              {/* Amazon Prime 1 Month */}
              <a
                href="https://vvdeals.cloud/product/amazon-prime-subscription-1-month-on-your-mail"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-2 group-hover:scale-105 transition-transform">
                    <AmazonPrimeLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      Amazon Prime (1 Month)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      1 Month Prime Video entertainment on your email.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>

              {/* CapCut Pro 7 Days */}
              <a
                href="https://vvdeals.cloud/product/capcut-pro-7-days"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-1.5 group-hover:scale-105 transition-transform overflow-hidden">
                    <CapCutLogo className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      CapCut Pro (7 Days)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      7 Days full pro editing features and viral effects.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>

              {/* Netflix Premium 5 Days */}
              <a
                href="https://vvdeals.cloud/product/netflix-premium-5-days-access"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-border/80 bg-background/60 p-3.5 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border p-2 group-hover:scale-105 transition-transform">
                    <NetflixLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      Netflix Premium (5 Days Access)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      5 Days Ultra HD content streaming access.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
                  <span className="hidden sm:inline">Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4 text-xs font-semibold text-muted-foreground">
            ⚡ Automatically eligible upon activating the Ultra Plan (Monthly cycle).
          </div>
        </div>
      </div>

      {/* Offer FAQs Section */}
      <div className="relative z-10 mt-12 rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-extrabold text-foreground">Frequently Asked Questions (Offer FAQs)</h3>
        </div>

        <div className="divide-y divide-border/70">
          {OFFER_FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div key={`faq-${index}`} className="py-4 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between gap-4 text-left font-bold text-foreground transition-colors hover:text-primary cursor-pointer"
                >
                  <span className="text-sm sm:text-base">{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted-foreground animate-in fade-in duration-200">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Terms & Conditions / Disclaimer Box */}
      <div className="relative z-10 mt-8 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 sm:p-7 dark:bg-amber-950/20">
        <div className="flex items-start gap-3.5">
          <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-2 text-xs sm:text-sm text-foreground/90">
            <h4 className="font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 text-xs">
              Offer Terms, Availability & Non-Liability Notice
            </h4>
            <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <strong className="text-foreground">Promotional Availability:</strong> The availability of third-party bonus credentials (Google AI, Amazon Prime, Spotify, CapCut, Netflix) is subject to stock and partner availability. This offer is promotional and may not be available all the time; it completely depends on VVDeals and may be modified or withdrawn without prior notice.
              </li>
              <li>
                <strong className="text-foreground">Fulfillment & Third-Party Services:</strong> All bonus digital products, licenses, and voucher codes are fulfilled directly by{' '}
                <a
                  href="https://vvdeals.cloud/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline text-purple-600 dark:text-purple-400"
                >
                  VVDeals (vvdeals.cloud)
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">Non-Liability & Warranty Disclaimer:</strong> DM Panda is an Instagram automation software platform and acts solely as a promotional partner for this bundle. <span className="underline font-bold text-foreground">DM Panda is NOT responsible</span> for third-party subscription activation, credentials validity, service downtime, regional geo-restrictions, account policy changes, or warranty-related issues on Google, Amazon, Spotify, CapCut, or Netflix.
              </li>
              <li>
                <strong className="text-foreground">Support & Inquiries:</strong> All fulfillment, warranty claims, and account credentials queries must be submitted directly to VVDeals via <a href="https://vvdeals.cloud/" target="_blank" rel="noopener noreferrer" className="font-bold underline text-purple-600 dark:text-purple-400">VVDeals.cloud</a> or by email at <a href="mailto:support@vvdeals.cloud" className="font-bold underline text-purple-600 dark:text-purple-400">support@vvdeals.cloud</a>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VVDealsOfferSection;
