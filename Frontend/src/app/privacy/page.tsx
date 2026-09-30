import React from 'react';
import { useSEO } from '../../hooks/useSEO';

const PrivacyPage: React.FC = () => {
  useSEO({
    title: 'Privacy Policy | DM Panda',
    description: 'Read the privacy policy of DM Panda. Learn how we collect, store, secure, and use personal and platform data in full compliance with Meta Graph API Platform Terms.',
    keywords: 'privacy policy dm panda, instagram data privacy, meta platform compliance, data deletion policy',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      'name': 'Privacy Policy | DM Panda',
      'description': 'Privacy Policy of DM Panda regarding data privacy and Meta Platform compliance.',
      'url': 'https://dmpanda.com/privacy'
    }
  });

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 sm:pb-24 max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 sm:mb-4 text-gray-900 dark:text-white">Privacy Policy</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 sm:mb-12 text-sm sm:text-base">Last updated: September 30, 2026</p>

        <div className="prose prose-lg mx-auto text-gray-600 dark:text-gray-400 space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed">
          <section>
            <p>
              DM Panda ("us", "we", or "our") operates the <a href="https://dmpanda.com" className="text-[#833AB4] dark:text-purple-400 hover:underline">https://dmpanda.com</a> website and the DM Panda automation platform (collectively, the "Service").
            </p>
            <p>
              This Privacy Policy explains how DM Panda collects, uses, stores, protects, and deletes personal information and Meta Platform Data when you use our Service. We are committed to transparency and adherence to international data protection standards (including GDPR, CCPA) and <strong>Meta's Platform Terms and Developer Data Use Policy</strong>.
            </p>
            <p>
              By connecting your Instagram professional account or using the Service, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Information Collection and Categories of Data</h2>
            <p>We only collect and process data strictly necessary to provide the automation features you configure:</p>

            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">A. User Account Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Identifiers:</strong> Name, email address, profile preferences, and subscription tier.</li>
              <li><strong>Authentication Credentials:</strong> Secure, salted password hashes (we never store plain-text passwords) and session authentication tokens.</li>
              <li><strong>Billing Data:</strong> Transaction references and payment status (handled securely via authorized payment gateways; we never store credit card numbers).</li>
            </ul>

            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">B. Meta / Instagram Platform Data</h3>
            <p>When you link your Instagram Professional account (Creator or Business) via official Instagram Login for Business OAuth, we receive authorized Platform Data via the Meta Graph API:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Profile Data:</strong> Instagram User ID, Instagram Username, account type, profile picture URL, and follower count.</li>
              <li><strong>Access Tokens:</strong> Long-lived Instagram user access tokens, securely encrypted at rest, used exclusively to make authorized Graph API calls on your behalf.</li>
              <li><strong>Media Identifiers:</strong> Instagram Media IDs, post captions, permalinks, and media types (Post, Reel, Story, Live) to allow you to select triggers for auto-replies.</li>
              <li><strong>Webhook Event Data:</strong> Ephemeral webhook notification payloads received from Meta when someone comments on your post, mentions you in a story, or sends you a direct message. This includes commenter/sender scoped IDs, comment/message text, and timestamps.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">2. How We Use Meta Platform Data &amp; Purpose Specification</h2>
            <p>In strict compliance with <strong>Section 3.a of Meta's Platform Terms</strong>, all Meta Platform Data accessed by DM Panda is used exclusively to deliver the functionality requested and configured by you:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Automated Direct Message Replies:</strong> Sending links, answers, or resources via Instagram Direct when a follower interacts with your content or triggers a keyword.</li>
              <li><strong>Comment Auto-Responses &amp; Moderation:</strong> Automatically publishing public replies to comments on your posts or reels, or hiding spam comments based on rules you create.</li>
              <li><strong>Story Mention Workflows:</strong> Sending a thank-you message or coupon code when another user mentions your handle in their Instagram Story.</li>
              <li><strong>Performance Analytics:</strong> Displaying aggregate metrics on automation response volumes and click rates inside your private dashboard.</li>
            </ul>
          </section>

          <section className="bg-gray-50 dark:bg-neutral-900/50 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Prohibited Uses of Data (What We NEVER Do)</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>NO Selling of Data:</strong> We never sell, rent, lease, or license Meta Platform Data or personal user data to any third party, data broker, or advertising network.</li>
              <li><strong>NO Advertising or Retargeting:</strong> We do not use Platform Data to build user advertising profiles, target ads, or perform cross-app tracking.</li>
              <li><strong>NO Surveillance or Profiling:</strong> We do not conduct surveillance, determine eligibility for credit, housing, or employment, or aggregate personal data for undisclosed purposes.</li>
              <li><strong>NO Permanent Message Archiving:</strong> We do not harvest, archive, or build persistent databases of your customers' personal message histories. Webhook interactions are processed in real-time and discarded.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">4. Meta Graph API Permissions Requested</h2>
            <p>DM Panda requests only the specific, granular permissions necessary to fulfill your automation settings:</p>
            <div className="overflow-x-auto my-4">
              <table className="min-w-full text-left border border-gray-200 dark:border-neutral-800 rounded-xl">
                <thead>
                  <tr className="bg-gray-100 dark:bg-neutral-900 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    <th className="py-3 px-4">Permission Scope</th>
                    <th className="py-3 px-4">Why It Is Needed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800 text-sm">
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-purple-600 dark:text-purple-400">instagram_business_basic</td>
                    <td className="py-3 px-4">Read basic account info (username, profile photo, user ID) to verify account ownership and display connected profiles.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-purple-600 dark:text-purple-400">instagram_business_manage_messages</td>
                    <td className="py-3 px-4">Receive incoming direct message webhooks and send automated responses requested by the account owner.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-purple-600 dark:text-purple-400">instagram_business_manage_comments</td>
                    <td className="py-3 px-4">Read comments on your posts/reels to trigger instant automated DM replies or automated public comment responses.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-purple-600 dark:text-purple-400">instagram_business_manage_insights</td>
                    <td className="py-3 px-4">Provide aggregate engagement analytics and trigger performance summaries on your private dashboard.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">5. Data Retention &amp; Storage Security</h2>
            <p>
              We implement industry-standard technical and organizational security controls to protect your information:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Encryption at Rest:</strong> All OAuth tokens and sensitive credentials are encrypted using AES-256 before storage.</li>
              <li><strong>Encryption in Transit:</strong> All communications between your browser, our servers, and Meta's Graph API occur strictly over HTTPS with TLS 1.3 encryption.</li>
              <li><strong>Ephemeral Processing:</strong> Incoming webhook payloads (comments, DMs) are processed in real-time memory to trigger your automation and are not retained in persistent long-term storage.</li>
              <li><strong>Retention Period:</strong> Account data and tokens are maintained only while your account remains active. If you unlink an account or delete your profile, all associated tokens and configuration records are permanently removed.</li>
            </ul>
          </section>

          <section className="border-l-4 border-[#833AB4] pl-4 sm:pl-6 py-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">6. Data Deletion Instructions (Your Rights &amp; Meta Compliance)</h2>
            <p className="mb-4">
              In accordance with Meta Platform Terms, GDPR, and CCPA, you have the right to request the complete deletion of your data at any time. We provide three simple ways to delete your data:
            </p>
            
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2">Option A: Self-Service Deletion via DM Panda Dashboard</h3>
            <p className="mb-3">
              You can immediately unlink your Instagram account or delete your entire DM Panda profile at any time:
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Log in to your dashboard at <a href="https://dmpanda.com" className="text-[#833AB4] dark:text-purple-400 hover:underline">dmpanda.com</a>.</li>
              <li>Navigate to <strong>Account Settings</strong>.</li>
              <li>Under "Connected Accounts", click <strong>Disconnect Account</strong> to erase all tokens and automation data for that specific Instagram profile.</li>
              <li>Alternatively, click <strong>Delete Account</strong> to permanently purge your entire user profile, email, settings, and all connected Instagram assets from our servers immediately.</li>
            </ol>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">Option B: Automatic Meta Deauthorization &amp; Data Deletion Request</h3>
            <p className="mb-3">
              If you remove the DM Panda application from your Facebook or Instagram account settings:
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Go to your Instagram or Facebook profile &rarr; <strong>Settings &amp; Privacy</strong> &rarr; <strong>Apps and Websites</strong>.</li>
              <li>Locate <strong>DM Panda</strong> and click <strong>Remove</strong>.</li>
              <li>Meta will immediately send an automated <strong>Data Deletion Request Callback</strong> to our endpoint (<code className="bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-xs">/api/auth/instagram/delete-data</code>).</li>
              <li>Our server automatically purges your stored Instagram tokens, active automations, and associated records, and provides you with a Confirmation Code to verify completion at our live tracking portal: <a href="https://api.dmpanda.com/api/auth/instagram/deletion-status" className="text-[#833AB4] dark:text-purple-400 hover:underline">https://api.dmpanda.com/api/auth/instagram/deletion-status</a>.</li>
            </ol>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">Option C: Direct Email Request</h3>
            <p>
              You may also email us directly at <a href="mailto:support@dmpanda.com" className="text-[#833AB4] dark:text-purple-400 hover:underline font-medium">support@dmpanda.com</a> or reach out through our <a href="/contact" className="text-[#833AB4] dark:text-purple-400 hover:underline">Contact Us</a> page with the subject line <em>"Data Deletion Request"</em> including your registered email or Instagram handle. All manual requests are processed and verified within 48 hours.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">7. Children's Privacy</h2>
            <p>
              Our Service is strictly intended for individuals aged 18 and older. We do not knowingly collect or solicit personal information from anyone under the age of 18. If we become aware that a child under 18 has provided us with personal data, we will immediately take steps to permanently delete such information from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Changes To This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect modifications in our services, applicable legal obligations, or Meta Platform Policies. Any changes will be posted on this page with an updated "Last updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">9. Contact &amp; Data Protection Inquiries</h2>
            <p>
              If you have any questions, feedback, or concerns regarding this Privacy Policy, your data rights, or our compliance with Meta Platform Terms, please contact us:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Email:</strong> <a href="mailto:support@dmpanda.com" className="text-[#833AB4] dark:text-purple-400 hover:underline">support@dmpanda.com</a></li>
              <li><strong>Contact Form:</strong> <a href="/contact" className="text-[#833AB4] dark:text-purple-400 hover:underline">https://dmpanda.com/contact</a></li>
              <li><strong>Website:</strong> <a href="https://dmpanda.com" className="text-[#833AB4] dark:text-purple-400 hover:underline">https://dmpanda.com</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
