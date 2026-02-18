import React, { useEffect } from 'react';

const ContactPage: React.FC = () => {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex items-center justify-center p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 tracking-tight">Contact Us</h2>
          <p className="text-lg text-gray-600">
            Have a question or want to work with us? We'd love to hear from you.
          </p>
        </div>

        <div className="bg-gray-50 p-8 rounded-3xl shadow-sm border border-gray-100">
          <form action="/contact" method="post" id="contact-form" className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                id="name"
                name="name"
                placeholder="Your Name"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                id="email"
                name="email"
                placeholder="name@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                id="subject"
                name="subject"
                placeholder="How can we help?"
                required
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none"
                id="message"
                name="message"
                rows={5}
                placeholder="Your message here..."
                required
              ></textarea>
            </div>
            <button type="submit" className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl">
              Send Message
            </button>
          </form>
        </div>

        <div className="text-center mt-12 space-y-2">
          <h5 className="text-lg font-bold">You can also reach us at:</h5>
          <div className="flex flex-col gap-1 text-gray-600">
            <p>
              <span className="font-semibold text-gray-900">Email:</span> support@dmpanda.com
            </p>
            <p>
              <span className="font-semibold text-gray-900">Phone:</span> +1 (555) 123-4567
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ContactPage;