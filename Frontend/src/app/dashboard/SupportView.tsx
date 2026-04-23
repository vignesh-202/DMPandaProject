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
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <section>
        <h3 className="text-xl font-semibold text-foreground mb-4">{isContactMode ? 'How To Reach Support' : 'Subscription Notes'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-content shadow-sm">
            <div className="p-4">
              <div className="text-xs font-black uppercase tracking-widest text-primary mb-2">{isContactMode ? 'Official Channel' : 'Monthly'}</div>
              <h4 className="text-lg font-bold text-foreground mb-2">{isContactMode ? SUPPORT_EMAIL : '30 Days'}</h4>
              <p className="text-sm text-muted-foreground">{isContactMode ? 'Email is the official support path for billing reviews, linking issues, and automation troubleshooting.' : 'Monthly plans renew every 30 days, not a calendar month.'}</p>
            </div>
          </Card>
          <Card className="border border-content shadow-sm">
            <div className="p-4">
              <div className="text-xs font-black uppercase tracking-widest text-primary mb-2">{isContactMode ? 'Before You Email' : 'Yearly'}</div>
              <h4 className="text-lg font-bold text-foreground mb-2">{isContactMode ? 'Collect the right details' : '364-Day Term'}</h4>
              <p className="text-sm text-muted-foreground">{isContactMode ? 'Include your login email, Instagram handle, and any payment or automation identifiers related to the issue.' : 'Yearly plans stay active for 364 days and show the lower monthly-on-yearly comparison price.'}</p>
            </div>
          </Card>
          <Card className="border border-content shadow-sm">
            <div className="p-4">
              <div className="text-xs font-black uppercase tracking-widest text-primary mb-2">{isContactMode ? 'Response Quality' : 'Checkout'}</div>
              <h4 className="text-lg font-bold text-foreground mb-2">{isContactMode ? 'Describe the problem exactly' : 'Server-Side Pricing'}</h4>
              <p className="text-sm text-muted-foreground">{isContactMode ? 'Tell the support team which section you used, what you expected, and what changed after loading or saving.' : 'The charged amount is always calculated by the backend using the current Appwrite pricing table.'}</p>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-foreground mb-4">{isContactMode ? 'What To Include In Your Email' : 'Frequently Asked Questions'}</h3>
        {isContactMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {CONTACT_GUIDE.map((item, index) => {
              const Icon = [Mail, Receipt, LifeBuoy, ShieldCheck][index] || Sparkles;
              return (
                <Card key={item.id} className="border border-content shadow-sm">
                  <div className="p-5 flex gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-foreground">{item.title}</h4>
                      <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
        <div className="space-y-4">
          {visibleFaqs.map((faq) => {
            const open = openAccordion === faq.id;
            return (
              <Card key={faq.id} className="!p-0 overflow-hidden border border-content shadow-sm transition-all">
                <button
                  onClick={() => setOpenAccordion(open ? null : faq.id)}
                  className="w-full flex justify-between items-center p-4 text-left bg-card hover:bg-muted/40 transition-colors"
                >
                  <span className="font-medium text-foreground">{faq.question}</span>
                  {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="p-4 border-t border-border text-muted-foreground">
                    {faq.answer}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        )}
      </section>

      <section>
        <h3 className="text-xl font-semibold text-foreground mb-4">{isContactMode ? 'Common Reasons To Email Support' : 'Contact Support'}</h3>
        {isContactMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CONTACT_REASONS.map((reason) => (
              <Card key={reason} className="border border-content shadow-sm">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-foreground font-medium">{reason}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">If you need a manual review of a payment, subscription change, linking failure, or automation issue, email support with your account details and any relevant payment or automation identifiers.</p>
            <a
              href="/contact"
              className="inline-flex items-center px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Us
            </a>
          </>
        )}
      </section>
    </div>
  );
};

export default SupportView;
