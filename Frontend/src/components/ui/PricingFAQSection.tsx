import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles, ShieldCheck, Zap, CreditCard, LucideIcon } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'plans' | 'limits' | 'billing' | 'safety';
}

const FAQ_ITEMS: FAQItem[] = [
  {
    category: 'plans',
    question: 'How does pricing per Instagram account work?',
    answer:
      'Every DMPanda subscription tier is dedicated to a single connected Instagram Professional account. If you manage multiple Instagram accounts for different brands, businesses, or clients, each account has its own independent subscription and separate action quota.'
  },
  {
    category: 'limits',
    question: 'What does "Unlimited Actions" on the Pro plan mean?',
    answer:
      'DMPanda does not place any artificial monthly, daily, or hourly action caps on Pro plan subscriptions. You can automate as many comments, direct messages, story replies, and conversation starters as your traffic generates. The only limit in place is Meta’s official technical infrastructure ceilings (e.g., 750 comment-to-DM replies per hour and 100 DM messages per second per account), which safeguard your profile from spam filters.'
  },
  {
    category: 'limits',
    question: 'What are Meta Rate Limits and how do they protect my account?',
    answer:
      'Meta enforces official technical rate limits on every Instagram Professional account: 750 DMs per hour for private comment replies, 100 direct messages per second for live conversations, and a rolling 24-hour comment budget calculated as 4,800 × your daily impressions. DMPanda’s smart queuing engine continuously buffers requests within these ceilings so your account remains 100% compliant with Instagram policies.'
  },
  {
    category: 'plans',
    question: 'Can I upgrade, downgrade, or cancel my subscription anytime?',
    answer:
      'Yes, absolutely. You have complete flexibility to upgrade, downgrade, or cancel your subscription at any time directly from the "My Plan" dashboard. When upgrading, changes take effect immediately with prorated billing. If you cancel, your automations will continue running normally until the end of your current prepaid billing period without any hidden fees or penalties.'
  },
  {
    category: 'plans',
    question: 'Is there a free trial or free tier available?',
    answer:
      'Yes! We offer a Free Plan that is 100% free forever. It includes up to 1,000 actions every month, allowing you to test comment-to-DM replies, story automations, and quick responses completely free before deciding to upgrade. No credit card is required to sign up.'
  },
  {
    category: 'billing',
    question: 'What is the difference between monthly and annual billing?',
    answer:
      'When you choose annual billing, you receive a substantial discount (equivalent to several months free) billed as a single annual payment. In addition, annual Pro subscribers unlock the exclusive partner tools bundle (including premium streaming, AI tools, and video editing perks worth up to ₹39,660).'
  },
  {
    category: 'limits',
    question: 'What happens if I reach my plan’s action limits on Free or Basic?',
    answer:
      'When your action quota is reached on Free or Basic tiers, DMPanda gracefully pauses sending new automated responses until your rolling hourly, daily, or monthly window resets. Your existing automations, flows, and connected accounts remain completely intact, and you can upgrade to Pro anytime to instantly resume delivery without caps.'
  },
  {
    category: 'limits',
    question: 'Do limits on one Instagram account affect my other connected accounts?',
    answer:
      'No. Meta rate limits and DMPanda quotas are strictly isolated per Instagram account. A viral reel or massive surge in comments on Account A will never exhaust the quota or slow down automation delivery on Account B.'
  },
  {
    category: 'billing',
    question: 'Which payment methods do you accept?',
    answer:
      'We accept all major payment methods including Credit Cards (Visa, MasterCard, Amex), Debit Cards, UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking across 50+ banks, and international payment methods processed through secure, bank-grade encrypted gateways.'
  },
  {
    category: 'safety',
    question: 'Will automating my Instagram account risk shadowbans or suspensions?',
    answer:
      'No. DMPanda operates exclusively through Meta’s official Graph API and Messenger API for Instagram with verified webhooks and OAuth permissions. We never ask for your Instagram password, and our queuing engine strictly respects Meta’s official rate limits to ensure your profile remains 100% safe.'
  },
  {
    category: 'plans',
    question: 'Can I reassign an active plan to a different Instagram account?',
    answer:
      'No, plan reassignments or transfers are not done automatically. If your premium Instagram account was disconnected by mistake, you must reconnect that exact same account first and contact our support team. If the support team is convinced by the reason provided, the plan can be reassigned back to that same account. However, if you request to transfer that plan to a completely different Instagram account, our management team will manually review whether it is a genuine cause or an attempt to abuse or exploit the system. Reassignments to another account are strictly an app management decision, and there is no guarantee that a transfer request will be approved.'
  }
];

const CATEGORY_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  all: { label: 'All Questions', icon: HelpCircle },
  plans: { label: 'Plans & Subscriptions', icon: Zap },
  limits: { label: 'Limits & Meta Rules', icon: ShieldCheck },
  billing: { label: 'Billing & Invoicing', icon: CreditCard },
  safety: { label: 'Safety & Compliance', icon: Sparkles }
};

interface PricingFAQSectionProps {
  className?: string;
}

const PricingFAQSection: React.FC<PricingFAQSectionProps> = ({ className = '' }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openIndexes, setOpenIndexes] = useState<number[]>([0, 1]); // default first two open

  const toggleIndex = (index: number) => {
    setOpenIndexes((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index]
    );
  };

  const filteredItems = FAQ_ITEMS.filter((item) =>
    activeCategory === 'all' ? true : item.category === activeCategory
  );

  return (
    <section className={`relative mt-16 sm:mt-24 ${className}`} aria-labelledby="pricing-faq-heading">
      {/* Section Header */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 mb-3">
          <HelpCircle size={14} />
          <span>Got Questions? We’ve Got Answers</span>
        </div>
        <h2 id="pricing-faq-heading" className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl lg:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 sm:text-base max-w-2xl mx-auto">
          Everything you need to know about DMPanda pricing, plan limits, Meta compliance, and billing.
        </p>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8 sm:mb-10">
        {Object.entries(CATEGORY_LABELS).map(([key, { label, icon: Icon }]) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-gray-950 text-white shadow-xs dark:bg-white dark:text-gray-950'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-gray-300 dark:hover:border-white/[0.16]'
              }`}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* FAQ Accordion List */}
      <div className="max-w-4xl mx-auto space-y-3">
        {filteredItems.map((item, idx) => {
          const isOpen = openIndexes.includes(idx);
          const catMeta = CATEGORY_LABELS[item.category];

          return (
            <div
              key={item.question}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'border-purple-500/40 bg-white shadow-md dark:border-purple-500/30 dark:bg-neutral-900/90'
                  : 'border-gray-200 bg-white/80 hover:border-gray-300 dark:border-white/[0.08] dark:bg-neutral-900/40 dark:hover:border-white/[0.14]'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleIndex(idx)}
                className="flex w-full items-center justify-between gap-4 p-4 sm:p-5 text-left transition-colors"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {catMeta && (
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 shrink-0">
                      {catMeta.label.split(' ')[0]}
                    </span>
                  )}
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-snug">
                    {item.question}
                  </h3>
                </div>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 ${
                    isOpen
                      ? 'rotate-180 border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400'
                  }`}
                >
                  <ChevronDown size={15} />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 animate-in fade-in-50 duration-150">
                  <div className="border-t border-gray-100 dark:border-white/[0.06] pt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {item.answer}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Still Have Questions CTA Banner */}
      <div className="mt-10 sm:mt-12 max-w-4xl mx-auto rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-500/[0.08] via-pink-500/[0.04] to-indigo-500/[0.08] p-6 sm:p-8 text-center dark:bg-neutral-900/60">
        <h3 className="text-lg font-black text-gray-900 dark:text-white sm:text-xl">
          Still have questions about our plans?
        </h3>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
          Our automation experts are here to help you select the ideal tier for your growth goals.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
          >
            Contact Support
          </a>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-neutral-900 px-5 py-2.5 text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </section>
  );
};

export default PricingFAQSection;
