import React from 'react';

const ContactPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans flex items-center justify-center p-4 transition-colors duration-500">
      <div className="container mx-auto max-w-4xl pt-24 sm:pt-28 pb-12">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight text-gray-900 dark:text-white">Get in Touch</h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
            Email DM Panda support for billing, account linking, or automation help.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,0.95fr] gap-6">
          <div className="bg-gray-50 dark:bg-white/[0.04] p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-white/[0.06]">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]">
              Official Support Email
            </div>
            <h3 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">support@dmpanda.com</h3>
            <p className="mt-4 text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
              Email the support team with your DM Panda login email, the Instagram account involved, and a short description of what you expected versus what happened.
            </p>
            <a
              href="mailto:support@dmpanda.com?subject=DM%20Panda%20Support"
              className="mt-6 inline-flex items-center justify-center w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3.5 sm:py-4 rounded-xl font-bold text-base hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              Email Support
            </a>
          </div>

          <div className="bg-gray-50 dark:bg-white/[0.04] p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-white/[0.06]">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">What to include in your email</h4>
            <ul className="mt-5 space-y-4 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              <li>Your DM Panda login email and the Instagram username or linked account.</li>
              <li>The dashboard section you used, such as Account Settings, My Plan, Transactions, or a specific automation editor.</li>
              <li>Your payment ID and selected plan if the problem is billing-related.</li>
              <li>The exact issue, expected result, and any error text you saw.</li>
            </ul>

            <div className="mt-7 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-5">
              <h5 className="text-sm font-bold text-gray-900 dark:text-white">Common reasons to contact support</h5>
              <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>Payment succeeded but your plan did not refresh.</p>
                <p>Instagram linking or relinking did not complete.</p>
                <p>An automation saved but is not firing as expected.</p>
                <p>A reply template, keyword, or collect-email route is not behaving correctly.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
