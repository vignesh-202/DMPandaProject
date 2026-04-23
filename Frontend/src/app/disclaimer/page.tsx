import React from 'react';

const DisclaimerPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 sm:pb-24 max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 sm:mb-4 text-gray-900 dark:text-white">Disclaimer</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 sm:mb-12 text-sm sm:text-base">Last updated: November 06, 2025</p>

        <div className="prose prose-lg mx-auto text-gray-600 dark:text-gray-400 space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed">
          <p>
            The information provided by DM Panda ("we," "us," or "our") on https://dmpanda.com (the "Site") and our mobile application is for general informational purposes only. All information on the Site and our mobile application is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site or our mobile application.
          </p>

          <p>
            DM Panda is an automation tool designed to work with the Instagram platform via the official Meta API. However, Instagram's policies and API can change without notice. While we strive to maintain compliance and functionality, we cannot guarantee uninterrupted service or compatibility with future Instagram updates or policy changes.
          </p>

          <p>
            Using automation tools on social media platforms carries inherent risks. Users are solely responsible for ensuring their use of DM Panda complies with Instagram's Terms of Service and Community Guidelines. Misuse of the tool, such as sending spam or violating platform policies, may result in restrictions or suspension of your Instagram account. DM Panda is not responsible for any actions taken against your account by Instagram.
          </p>

          <p>
            DM Panda uses Platform Data solely to enable automated messaging and engagement workflows on Instagram, as authorized by the account owner. Our app does not store or use any user content such as posts, comments, or direct messages. We only process and temporarily store the minimum data necessary to perform automation tasks configured by the user.
          </p>

          <p>
            We are not affiliated, associated, authorized, endorsed by, or in any way officially connected with Instagram, Meta Platforms, Inc., or any of its subsidiaries or affiliates. The official Instagram website can be found at https://www.instagram.com.
          </p>

          <p>
            Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the site or our mobile application or reliance on any information provided on the site and our mobile application. Your use of the site and our mobile application and your reliance on any information on the site and our mobile application is solely at your own risk.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerPage;
