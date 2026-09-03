import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Gift,
  Zap,
  Sparkles,
  CheckCircle2
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
    className={`${className} object-cover rounded-lg shrink-0`}
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
  answer: React.ReactNode;
}

const OFFER_FAQS: OfferFAQ[] = [
  {
    question: 'How do I claim my bonus Google AI, Amazon Prime, Spotify, CapCut, and Netflix perks?',
    answer: (
      <div className="space-y-2">
        <p>
          Once you subscribe to an eligible full-price DM Panda Ultra plan (Monthly or Yearly), you can activate your bonus subscriptions directly with VV Deals:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>WhatsApp Support:</strong> Message VV Deals support directly on WhatsApp with your DM Panda payment reference ID to receive activation details.
          </li>
          <li>
            <strong>Support Page:</strong> You can also submit your details directly via the{' '}
            <a
              href="https://vvdeals.cloud/support"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
            >
              VV Deals Support Page
            </a>{' '}
            or email{' '}
            <a
              href="mailto:support@vvdeals.cloud"
              className="font-bold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
            >
              support@vvdeals.cloud
            </a>
            .
          </li>
        </ul>
      </div>
    )
  },
  {
    question: 'What exact products and values are bundled with Ultra plans?',
    answer: (
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <p className="font-extrabold text-foreground text-xs sm:text-sm uppercase tracking-wide text-purple-600 dark:text-purple-400">
              ★ Ultra Yearly Plan (5 Subscriptions — Total Value: ₹39,660):
            </p>
            <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[11px] font-black text-purple-700 dark:text-purple-300 border border-purple-500/25">
              ₹39,660 Total Value
            </span>
          </div>
          <ul className="space-y-1.5 pl-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <div>
                <strong>Google AI Pro (18 Months) — ₹35,100:</strong> Gemini Pro AI & 2TB cloud storage —{' '}
                <a
                  href="https://vvdeals.cloud/product/google-ai-pro-18-months"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <div>
                <strong>Amazon Prime (6 Months) — ₹1,794:</strong> Prime Video & benefits on your email —{' '}
                <a
                  href="https://vvdeals.cloud/product/amazon-prime-subscription-6-months-on-your-email"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <div>
                <strong>Spotify Premium (3 Months) — ₹597:</strong> Ad-free music & offline listening —{' '}
                <a
                  href="https://vvdeals.cloud/product/spotify-premium-individual-3-months"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <div>
                <strong>CapCut Pro (1 Month) — ₹2,000:</strong> Pro transitions, AI effects & 4K exports —{' '}
                <a
                  href="https://vvdeals.cloud/product/capcut-pro-1-month"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <div>
                <strong>Netflix Premium (1 Month, 1 Device) — ₹169:</strong> 1-device Ultra HD 4K streaming —{' '}
                <a
                  href="https://vvdeals.cloud/product/netflix-premium-1-month-1-device-access"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
          </ul>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <p className="font-extrabold text-foreground text-xs sm:text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              ★ Ultra Monthly Plan (3 Subscriptions — Total Value: ₹898):
            </p>
            <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-black text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
              ₹898 Total Value
            </span>
          </div>
          <ul className="space-y-1.5 pl-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 font-bold">•</span>
              <div>
                <strong>Amazon Prime (1 Month) — ₹299:</strong> Prime Video streaming on your email —{' '}
                <a
                  href="https://vvdeals.cloud/product/amazon-prime-subscription-1-month-on-your-mail"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 font-bold">•</span>
              <div>
                <strong>CapCut Pro (7 Days) — ₹500:</strong> Pro editing features & effects —{' '}
                <a
                  href="https://vvdeals.cloud/product/capcut-pro-7-days"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 font-bold">•</span>
              <div>
                <strong>Netflix Premium (5 Days Access on Mobile/TV, 1 Device) — ₹99:</strong> Ultra HD 4K streaming access on Mobile / TV —{' '}
                <a
                  href="https://vvdeals.cloud/product/netflix-premium-5-days-access"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  View on VVDeals
                </a>
              </div>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    question: 'Is the offer valid if I use a discount coupon during checkout?',
    answer: (
      <p>
        <strong>No.</strong> The VV Deals promotional bonus subscriptions offer is <strong>strictly not valid if any discount coupon or promo code is applied</strong> during billing. Only full-price Ultra plan subscriptions (without coupon deductions) qualify for the free bonus subscriptions.
      </p>
    )
  },
  {
    question: 'How are the credentials or vouchers delivered?',
    answer: (
      <p>
        Digital vouchers, account invites, or login credentials are dispatched electronically by VV Deals within 24–48 hours after payment verification.
      </p>
    )
  },
  {
    question: 'Can I claim the offer multiple times if I upgrade multiple Instagram accounts?',
    answer: (
      <p>
        Yes, each individual full-price Ultra plan subscription activated on a linked Instagram account qualifies for its respective VV Deals bonus perks.
      </p>
    )
  },
  {
    question: 'Who provides technical support and warranty for the bonus subscriptions?',
    answer: (
      <p>
        All customer support, login guidance, and inquiries regarding external subscriptions (Google, Amazon, Spotify, CapCut, Netflix) are handled exclusively by VV Deals. DM Panda provides Instagram automation software only and has no control or liability over third-party digital products.
      </p>
    )
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
      className={`relative scroll-mt-24 overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-950/15 via-card to-card p-6 sm:p-10 lg:p-12 shadow-xl backdrop-blur-xl ${className}`}
    >
      {/* Decorative ambient glows */}
      <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Header & Title */}
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-4 border border-purple-500/20 shadow-xs">
          <Gift size={13} className="text-purple-600 dark:text-purple-400" />
          <span>Exclusive Partner Benefit</span>
          <span className="text-muted-foreground">•</span>
          <a
            href="https://vvdeals.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
          >
            Powered by VV Deals
          </a>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
          ₹39,660 in Premium Subscriptions. Included Free with Ultra.
        </h2>

        <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Upgrade to DM Panda Ultra and receive complimentary bonus subscriptions to industry-leading AI, video editing, 4K streaming, and music tools.
        </p>

        {/* 3 Structured Benefit Highlights Bar */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/60 p-3.5 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Gift size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-foreground">100% Free Partner Perks</p>
              <p className="text-[11px] text-muted-foreground truncate">Bundled with Ultra plans</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/60 p-3.5 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-foreground">Genuine Subscriptions</p>
              <p className="text-[11px] text-muted-foreground truncate">Official accounts & access</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/60 p-3.5 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Zap size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-foreground">Fast 24–48h Delivery</p>
              <p className="text-[11px] text-muted-foreground truncate">WhatsApp & Email dispatch</p>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Detailed Breakdown Cards */}
      <div className="relative z-10 mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Tier 1: Ultra Yearly Plan */}
        <div className="relative flex flex-col justify-between rounded-3xl border-2 border-purple-500/40 bg-gradient-to-b from-purple-500/[0.04] via-card to-card p-6 sm:p-8 shadow-xl dark:border-purple-500/40">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-border/80 pb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 border border-purple-500/30 mb-2">
                  <Gift size={12} className="text-purple-600 dark:text-purple-400" />
                  <span>Yearly Ultra Bundle</span>
                </div>
                <h3 className="text-2xl font-black text-foreground">Ultra Yearly Plan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">5 Subscriptions Included Free</p>
              </div>

              {/* Big Text Total Worth */}
              <div className="sm:text-right">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                  ₹39,660
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mt-0.5">
                  Total Market Worth
                </p>
              </div>
            </div>

            {/* Product List */}
            <div className="mt-6 space-y-3">
              {/* Google AI Pro 18 Months */}
              <a
                href="https://vvdeals.cloud/product/google-ai-pro-18-months"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2.5 group-hover:scale-105 transition-transform">
                    <GoogleLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Google AI Pro (18 Months)
                      </p>
                      <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-xs font-black text-purple-700 dark:text-purple-300 border border-purple-500/25">
                        ₹35,100 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gemini Pro AI capabilities and 2TB high-speed cloud storage.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* Amazon Prime 6 Months */}
              <a
                href="https://vvdeals.cloud/product/amazon-prime-subscription-6-months-on-your-email"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2.5 group-hover:scale-105 transition-transform">
                    <AmazonPrimeLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Amazon Prime (6 Months)
                      </p>
                      <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-black text-cyan-700 dark:text-cyan-300 border border-cyan-500/25">
                        ₹1,794 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      6 Months Prime Video streaming and shopping benefits on your email.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* CapCut Pro 1 Month */}
              <a
                href="https://vvdeals.cloud/product/capcut-pro-1-month"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2 group-hover:scale-105 transition-transform overflow-hidden">
                    <CapCutLogo className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        CapCut Pro (1 Month)
                      </p>
                      <span className="rounded-md bg-pink-500/15 px-2 py-0.5 text-xs font-black text-pink-700 dark:text-pink-300 border border-pink-500/25">
                        ₹2,000 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pro transitions, AI video effects, auto-captions, and 4K exports.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* Spotify Premium 3 Months */}
              <a
                href="https://vvdeals.cloud/product/spotify-premium-individual-3-months"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2.5 group-hover:scale-105 transition-transform">
                    <SpotifyLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Spotify Premium (3 Months)
                      </p>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-black text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                        ₹597 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      3 Months ad-free music streaming with high-quality offline listening.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* Netflix Premium 1 Month */}
              <a
                href="https://vvdeals.cloud/product/netflix-premium-1-month-1-device-access"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2.5 group-hover:scale-105 transition-transform">
                    <NetflixLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Netflix Premium (1 Month, 1 Device)
                      </p>
                      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-black text-red-700 dark:text-red-300 border border-red-500/25">
                        ₹169 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      1 Month Ultra HD 4K streaming access on 1 device.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border/80 pt-4 text-xs text-muted-foreground font-semibold">
            <span>Eligible upon full-price yearly billing</span>
            <span className="font-bold text-foreground">₹39,660 Total Value</span>
          </div>
        </div>

        {/* Tier 2: Ultra 1-Month Plan */}
        <div className="relative flex flex-col justify-between rounded-3xl border border-border/90 bg-card p-6 sm:p-8 shadow-lg">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-border/80 pb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 mb-2">
                  <Gift size={12} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Monthly Ultra Bundle</span>
                </div>
                <h3 className="text-2xl font-black text-foreground">Ultra 1-Month Plan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">3 Subscriptions Included Free</p>
              </div>

              {/* Big Text Total Worth */}
              <div className="sm:text-right">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                  ₹898
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-0.5">
                  Total Market Worth
                </p>
              </div>
            </div>

            {/* Product List */}
            <div className="mt-6 space-y-3">
              {/* Amazon Prime 1 Month */}
              <a
                href="https://vvdeals.cloud/product/amazon-prime-subscription-1-month-on-your-mail"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2.5 group-hover:scale-105 transition-transform">
                    <AmazonPrimeLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Amazon Prime (1 Month)
                      </p>
                      <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-black text-cyan-700 dark:text-cyan-300 border border-cyan-500/25">
                        ₹299 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      1 Month Prime Video entertainment on your personal email.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* CapCut Pro 7 Days */}
              <a
                href="https://vvdeals.cloud/product/capcut-pro-7-days"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2 group-hover:scale-105 transition-transform overflow-hidden">
                    <CapCutLogo className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        CapCut Pro (7 Days)
                      </p>
                      <span className="rounded-md bg-pink-500/15 px-2 py-0.5 text-xs font-black text-pink-700 dark:text-pink-300 border border-pink-500/25">
                        ₹500 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      7 Days full access to pro effects, transitions, and creator tools.
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* Netflix Premium 5 Days on Mobile/TV */}
              <a
                href="https://vvdeals.cloud/product/netflix-premium-5-days-access"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-purple-500/50 hover:bg-background/90"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 p-2.5 group-hover:scale-105 transition-transform">
                    <NetflixLogo className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Netflix Premium (5 Days — Mobile / TV)
                      </p>
                      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-black text-red-700 dark:text-red-300 border border-red-500/25">
                        ₹99 Value
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      5 Days Ultra HD content streaming access on Mobile / TV (1 device).
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border/80 pt-4 text-xs text-muted-foreground font-semibold">
            <span>Eligible upon full-price monthly billing</span>
            <span className="font-bold text-foreground">₹898 Total Value</span>
          </div>
        </div>
      </div>

      {/* Offer FAQs Section */}
      <div className="relative z-10 mt-14 rounded-3xl border border-border bg-card/70 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-extrabold text-foreground">Frequently Asked Questions</h3>
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
                  <div className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground animate-in fade-in duration-200">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Terms & Conditions / Non-Liability Disclaimer Box */}
      <div className="relative z-10 mt-8 rounded-3xl border border-border/80 bg-background/50 p-6 sm:p-7">
        <div className="flex items-start gap-3.5">
          <ShieldAlert className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
          <div className="space-y-2 text-xs sm:text-sm text-foreground/90">
            <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-xs">
              Offer Terms, Availability & Partner Fulfillment Notice
            </h4>
            <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              <li>
                <strong className="text-foreground">Coupon Ineligibility:</strong> This promotional offer is strictly valid on full-price Ultra plan subscriptions. If any coupon or promotional discount code is applied during checkout, the account is not eligible for free partner perks.
              </li>
              <li>
                <strong className="text-foreground">Third-Party Warranty & Fulfillment:</strong> All subscriptions and credentials are provided directly by VV Deals. DM Panda does not warrant or guarantee third-party platform uptime or policies.
              </li>
              <li>
                <strong className="text-foreground">Support:</strong> For voucher dispatch, account activation, or questions, reach out to VV Deals via WhatsApp or the{' '}
                <a
                  href="https://vvdeals.cloud/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline text-purple-600 dark:text-purple-400 hover:opacity-80"
                >
                  VV Deals Support Page
                </a>
                .
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VVDealsOfferSection;
