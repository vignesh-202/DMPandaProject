import React from 'react';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 sm:pb-24 max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 sm:mb-4 text-gray-900 dark:text-white">Terms & Conditions</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 sm:mb-12 text-sm sm:text-base">Last updated: November 06, 2025</p>

        <div className="prose prose-lg mx-auto text-gray-600 dark:text-gray-400 space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed">
          <section>
            <p>
              Welcome to DM Panda! These terms and conditions outline the rules and regulations for the use of DM Panda's Website, located at https://dmpanda.com.
            </p>
            <p>
              By accessing this website we assume you accept these terms and conditions. Do not continue to use DM Panda if you do not agree to take all of the terms and conditions stated on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">License</h2>
            <p>
              Unless otherwise stated, DM Panda and/or its licensors own the intellectual property rights for all material on DM Panda. All intellectual property rights are reserved. You may access this from DM Panda for your own personal use subjected to restrictions set in these terms and conditions.
            </p>
            <p className="mt-2">You must not:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Republish material from DM Panda</li>
              <li>Sell, rent or sub-license material from DM Panda</li>
              <li>Reproduce, duplicate or copy material from DM Panda</li>
              <li>Redistribute content from DM Panda</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">User Account</h2>
            <p>
              To access certain features of the Service, you may be required to create an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for any activities or actions under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Subscriptions, Duration, and Expiry</h2>
            <p>
              Paid DM Panda plans are sold on fixed validity windows. Monthly plans run for <strong className="text-gray-900 dark:text-gray-200">30 days</strong> from the verified payment time. Yearly plans run for <strong className="text-gray-900 dark:text-gray-200">364 days</strong> from the verified payment time.
            </p>
            <p>
              Runtime access to features, limits, linked Instagram account capacity, and automation availability is controlled by your account&apos;s effective plan state inside DM Panda. If a paid plan expires or is changed, feature access, limits, and account availability can change immediately according to the effective plan applied to your account.
            </p>
            <p>
              If your plan no longer supports all previously linked Instagram accounts, those extra accounts may remain linked for management purposes, but DM Panda can block dashboard access and automation processing for them until your effective plan allows them again or they are manually removed.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Acceptable Use</h2>
            <p>You agree not to use the Service in any way that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violates any applicable national or international law or regulation.</li>
              <li>Infringes upon or violates our intellectual property rights or the intellectual property rights of others.</li>
              <li>Is harmful, fraudulent, deceptive, threatening, harassing, defamatory, obscene, or otherwise objectionable.</li>
              <li>Jeopardizes the security of your DM Panda account or anyone else's.</li>
              <li>Attempts, in any manner, to obtain the password, account, or other security information from any other user.</li>
              <li>Violates the security of any computer network, or cracks any passwords or security encryption codes.</li>
              <li>Interferes with or disrupts the integrity or performance of the Service.</li>
              <li>Violates Instagram's Terms of Service or Community Guidelines.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Service Usage</h2>
            <p>
              DM Panda uses Platform Data from Meta's APIs solely to enable automated messaging and engagement workflows on Instagram, as authorized by the account owner. The app does not store or use any user content such as posts, comments, or direct messages, beyond what is necessary to perform the requested automations.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Termination</h2>
            <p>
              We may terminate or suspend your access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Limitation of Liability</h2>
            <p>
              In no event shall DM Panda, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Changes</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us via the <a href="/contact" className="text-[#833AB4] dark:text-purple-400 hover:underline">Contact Us</a> page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
