import React, { useMemo, useState } from 'react';
import Card from '../../components/ui/card';
import { ChevronDown, ChevronUp, Mail, LifeBuoy, Receipt, ShieldCheck, Sparkles } from 'lucide-react';

const faqs = [
  {
    id: 'billing-period',
    question: 'How is the billing period calculated?',
    answer: 'Monthly plans stay active for 30 days from the verified payment time. Yearly plans stay active for 364 days. The yearly cards show the lower monthly-on-yearly price, while the smaller text shows the full billed-yearly total.'
  },
  {
    id: 'yearly-display',
    question: 'Why does the yearly plan show a monthly number and a yearly total?',
    answer: 'The large number helps you compare the effective monthly cost of committing to a yearly plan. The smaller line under it shows what you are actually charged upfront for the full 364-day term.'
  },
  {
    id: 'checkout',
    question: 'When is a coupon applied?',
    answer: 'Coupons are validated on the backend at checkout using the exact plan, billing cycle, and currency you selected. The billed total already reflects any accepted discount.'
  },
  {
    id: 'plan-refresh',
    question: 'What happens after payment succeeds?',
    answer: 'The dashboard keeps a loading state while your payment is verified and the latest subscription data is fetched. Your plan view updates only after the new plan is available on the frontend.'
  },
  {
    id: 'link-instagram',
    question: 'What should I check if an Instagram account is not linking?',
    answer: 'Make sure the Instagram profile is connected to a Meta Business asset, the correct account is selected during OAuth, and the account still shows as active inside Account Settings after the redirect completes.'
  },
  {
    id: 'automation-not-firing',
    question: 'What should I check if an automation is not firing?',
    answer: 'Confirm the linked Instagram account is active, the automation itself is active, the keyword matches exactly, the selected reply template still exists, and the automation is attached to the correct post, reel, story, live session, or global trigger.'
  },
  {
    id: 'keyword-conflicts',
    question: 'Why am I seeing keyword conflict errors?',
    answer: 'The workspace prevents overlapping keywords when another automation or a global trigger is already using the same trigger phrase for the same account scope. Remove the duplicate keyword or update the existing rule before saving.'
  },
  {
    id: 'template-updates',
    question: 'What happens when I update a reply template?',
    answer: 'Any automation using that template will reflect the updated template content the next time it runs, so template edits should be treated as shared changes across linked automations.'
  },
  {
    id: 'comment-moderation',
    question: 'How does comment moderation interact with automations?',
    answer: 'Comment moderation keywords are kept separate from reply automation keywords. If a moderation keyword is already reserved for hide/delete actions, the workspace blocks reuse in regular automations to prevent conflicting behavior.'
  },
  {
    id: 'collect-email',
    question: 'Why does collect-email depend on destination setup?',
    answer: 'The automation can only store collected emails after a verified destination is configured. If the destination is missing or unlinked, the flow can fail until the collector destination is reconnected.'
  },
  {
    id: 'unlink-delete-account',
    question: 'What is the difference between unlinking and deleting an Instagram account record?',
    answer: 'Unlinking disconnects the active Instagram connection and stops automations for that account. Deleting the record is a deeper cleanup action that can remove linked operational data and requires relinking from scratch later.'
  }
];

const SUPPORT_EMAIL = 'support@dmpanda.com';

const CONTACT_GUIDE = [
  {
    id: 'include-account',
    title: 'Include your account details',
    description: 'Mention your login email and the Instagram username or account ID involved.'
  },
  {
    id: 'include-billing',
    title: 'Add payment details when billing is involved',
    description: 'For plan or checkout issues, include the Razorpay payment ID, selected plan, and the time the payment was made.'
  },
  {
    id: 'describe-issue',
    title: 'Describe the exact issue clearly',
    description: 'Tell support which dashboard section you used, what you expected, and what happened instead.'
  },
  {
    id: 'check-dashboard-first',
    title: 'Check the relevant dashboard section first',
    description: 'Use Account Settings, My Plan, Transactions, Support, Analytics, or the automation editor to confirm the latest state before sending the email.'
  }
];

const CONTACT_REASONS = [
  'Payment verified but plan not updated',
  'Instagram account linking or relinking failed',
  'Automation saved but not firing as expected',
  'Reply template or keyword conflict issue',
  'Comment moderation, collect-email, or destination routing issue'
];

type SupportViewProps = {
  mode?: 'support' | 'contact';
};

const SupportView: React.FC<SupportViewProps> = ({ mode = 'support' }) => {
  const [openAccordion, setOpenAccordion] = useState<string | null>(faqs[0].id);
  const isContactMode = mode === 'contact';

  const title = isContactMode ? 'Contact Support' : 'Support';
  const description = isContactMode
    ? 'Use the official support mailbox for billing, account, and automation help.'
    : 'Billing, automation access, account health, and plan refresh details are documented here so the dashboard matches the live product flow.';
  const visibleFaqs = useMemo(() => (isContactMode ? faqs.slice(0, 6) : faqs), [isContactMode]);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1.5">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <section>
        <h3 className="text-base font-semibold text-foreground mb-3.5">{isContactMode ? 'How To Reach Support' : 'Subscription Notes'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{isContactMode ? 'Official Channel' : 'Monthly'}</div>
            <h4 className="text-base font-semibold text-foreground mb-1.5">{isContactMode ? SUPPORT_EMAIL : '30 Days'}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{isContactMode ? 'Email is the official support path for billing reviews, linking issues, and automation troubleshooting.' : 'Monthly plans renew every 30 days, not a calendar month.'}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{isContactMode ? 'Before You Email' : 'Yearly'}</div>
            <h4 className="text-base font-semibold text-foreground mb-1.5">{isContactMode ? 'Collect the right details' : '364-Day Term'}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{isContactMode ? 'Include your login email, Instagram handle, and any payment or automation identifiers related to the issue.' : 'Yearly plans stay active for 364 days and show the lower monthly-on-yearly comparison price.'}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{isContactMode ? 'Response Quality' : 'Checkout'}</div>
            <h4 className="text-base font-semibold text-foreground mb-1.5">{isContactMode ? 'Describe the problem exactly' : 'Server-Side Pricing'}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{isContactMode ? 'Tell the support team which section you used, what you expected, and what changed after loading or saving.' : 'The charged amount is always calculated by the backend using the current Appwrite pricing table.'}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-foreground mb-3.5">{isContactMode ? 'What To Include In Your Email' : 'Frequently Asked Questions'}</h3>
        {isContactMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {CONTACT_GUIDE.map((item, index) => {
              const Icon = [Mail, Receipt, LifeBuoy, ShieldCheck][index] || Sparkles;
              return (
                <div key={item.id} className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-muted text-foreground border border-border flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleFaqs.map((faq) => {
              const open = openAccordion === faq.id;
              return (
                <div key={faq.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all">
                  <button
                    onClick={() => setOpenAccordion(open ? null : faq.id)}
                    className="w-full flex justify-between items-center p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground">{faq.question}</span>
                    {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-base font-semibold text-foreground mb-3.5">{isContactMode ? 'Common Reasons To Email Support' : 'Contact Support'}</h3>
        {isContactMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CONTACT_REASONS.map((reason) => (
              <div key={reason} className="rounded-xl border border-border bg-card p-3.5 shadow-xs flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground border border-border flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs text-foreground font-medium">{reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">If you need a manual review of a payment, subscription change, linking failure, or automation issue, email support with your account details and any relevant payment or automation identifiers.</p>
            <a
              href="/contact"
              className="inline-flex items-center h-9 px-4 bg-primary text-primary-foreground text-xs font-medium rounded-xl hover:bg-primary/90 transition shadow-xs"
            >
              <Mail className="w-3.5 h-3.5 mr-2" />
              Contact Us
            </a>
          </div>
        )}
      </section>
    </div>
  );
};

export default SupportView;
