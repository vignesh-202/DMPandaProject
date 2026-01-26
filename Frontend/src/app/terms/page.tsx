import React, { useEffect } from 'react';

const TermsPage: React.FC = () => {
  useEffect(() => {
    document.documentElement.classList.add('light');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  return (
    <section
      className="legal-page container mx-auto p-8 rounded-lg shadow-md"
      style={{ backgroundColor: 'white', color: 'black' }}
    >
      <h2 className="text-center mb-4 text-3xl font-bold">Terms & Conditions</h2>
      <p>
        Welcome to DM Panda! These terms and conditions outline the rules and regulations for the use of DM Panda's
        Website, located at https://dmpanda.com.
      </p>
      <p>
        By accessing this website we assume you accept these terms and conditions. Do not continue to use DM Panda if
        you do not agree to take all of the terms and conditions stated on this page.
      </p>

      <h3 className="text-2xl font-bold mt-4">License</h3>
      <p>
        Unless otherwise stated, DM Panda and/or its licensors own the intellectual property rights for all material on
        DM Panda. All intellectual property rights are reserved. You may access this from DM Panda for your own
        personal use subjected to restrictions set in these terms and conditions.
      </p>
      <p>You must not:</p>
      <ul>
        <li>Republish material from DM Panda</li>
        <li>Sell, rent or sub-license material from DM Panda</li>
        <li>Reproduce, duplicate or copy material from DM Panda</li>
        <li>Redistribute content from DM Panda</li>
      </ul>

      <h3 className="text-2xl font-bold mt-4">User Account</h3>
      <p>
        To access certain features of the Service, you may be required to create an account. You agree to provide
        accurate, current, and complete information during the registration process and to update such information to
        keep it accurate, current, and complete. You are responsible for safeguarding your password and for any
        activities or actions under your account.
      </p>

      <h3 className="text-2xl font-bold mt-4">Acceptable Use</h3>
      <p>You agree not to use the Service in any way that:</p>
      <ul>
        <li>Violates any applicable national or international law or regulation.</li>
        <li>Infringes upon or violates our intellectual property rights or the intellectual property rights of others.</li>
        <li>
          Is harmful, fraudulent, deceptive, threatening, harassing, defamatory, obscene, or otherwise objectionable.
        </li>
        <li>Jeopardizes the security of your DM Panda account or anyone else’s.</li>
        <li>Attempts, in any manner, to obtain the password, account, or other security information from any other user.</li>
        <li>Violates the security of any computer network, or cracks any passwords or security encryption codes.</li>
        <li>Interferes with or disrupts the integrity or performance of the Service.</li>
        <li>Violates Instagram's Terms of Service or Community Guidelines.</li>
      </ul>

      <h3 className="text-2xl font-bold mt-4">Service Usage</h3>
      <p>
        DM Panda uses Platform Data from Meta's APIs solely to enable automated messaging and engagement
        workflows on Instagram, as authorized by the account owner. The app does not store or use any user content
        such as posts, comments, or direct messages, beyond what is necessary to perform the requested automations.
      </p>

      <h3 className="text-2xl font-bold mt-4">Termination</h3>
      <p>
        We may terminate or suspend your access to our Service immediately, without prior notice or liability, for any
        reason whatsoever, including without limitation if you breach the Terms.
      </p>

      <h3 className="text-2xl font-bold mt-4">Limitation of Liability</h3>
      <p>
        In no event shall DM Panda, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable
        for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of
        profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or
        inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any
        content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or
        content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or
        not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to
        have failed of its essential purpose.
      </p>

      <h3 className="text-2xl font-bold mt-4">Governing Law</h3>
      <p>
        These Terms shall be governed and construed in accordance with the laws of India, without regard
        to its conflict of law provisions.
      </p>

      <h3 className="text-2xl font-bold mt-4">Changes</h3>
      <p>
        We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is
        material we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a
        material change will be determined at our sole discretion.
      </p>

      <h3 className="text-2xl font-bold mt-4">Contact Us</h3>
      <p>
        If you have any questions about these Terms, please contact us via the{' '}
        <a href="/contact" className="text-blue-600">
          Contact Us
        </a>{' '}
        page.
      </p>
      <p>Last updated: November 06, 2025</p>
    </section>
  );
};

export default TermsPage;