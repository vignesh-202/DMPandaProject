import React from 'react';

const RefundPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 sm:pb-24 max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 sm:mb-4 text-gray-900 dark:text-white">Refund Policy</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 sm:mb-12 text-sm sm:text-base">Last updated: November 06, 2025</p>

        <div className="prose prose-lg mx-auto text-gray-600 dark:text-gray-400 space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed">
          <section>
            <p>
              At DM Panda, we are committed to providing a reliable and effective service. Our refund policy is designed to be transparent and fair to all our users. Please read the following terms carefully.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">General Policy</h2>
            <p>
              Generally, we do not offer refunds for our services once a payment has been made. All sales are considered final. This is because our services are delivered instantly and involve significant operational costs.
            </p>
            <p>
              For clarity, monthly subscriptions run for 30 days and yearly subscriptions run for 364 days from the verified payment time. Plan expiry, downgrade behavior, feature availability, and account-access enforcement follow the effective runtime plan applied to your DM Panda account.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Exceptions for Refunds</h2>
            <p>Refunds will only be considered under the following specific circumstances:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong className="text-gray-900 dark:text-gray-200">Service-Side Issues:</strong> If you experience a significant failure or problem with our service that is directly attributable to DM Panda and we are unable to resolve it within a reasonable timeframe, you may be eligible for a refund. This is determined on a case-by-case basis.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-gray-200">Erroneous or Wrongful Payments:</strong> If you believe a payment was made in error (e.g., a duplicate charge or an incorrect amount), you may request a refund.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Process for Wrongful Payment Claims</h2>
            <p>
              In the case of a claim for a wrongful payment, our team will conduct a manual review of your account activity and payment history. To be eligible for a refund, we must be able to verify that the payment was indeed made in error. This decision is at the sole discretion of DM Panda. We reserve the right to refuse a refund if we do not find sufficient evidence of a wrongful payment.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Refund Timeline</h2>
            <p>
              If a refund is approved, the processing time can vary. The refund may take anywhere from <strong className="text-gray-900 dark:text-gray-200">7 to 30 business days</strong> to be credited to your original method of payment. The exact time depends on several factors, including the payment gateway, your bank's policies, and other external factors beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">How to Request a Refund</h2>
            <p>
              To request a refund, please contact our support team through the <a href="/contact" className="text-[#833AB4] dark:text-purple-400 hover:underline">Contact Us</a> page. Please provide all relevant details, including your account information, transaction ID, and a clear explanation of the reason for your request.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Changes to this Policy</h2>
            <p>
              We reserve the right to modify this refund policy at any time. Any changes will be posted on this page, and it is your responsibility to review it periodically.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;
