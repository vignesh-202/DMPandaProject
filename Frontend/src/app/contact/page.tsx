import React from 'react';

const ContactPage: React.FC = () => {
  return (
    <div className="container mx-auto bg-white">
      <div className="flex justify-center">
        <div className="w-full md:w-2/3">
          <h2 className="text-center mb-4 text-3xl font-bold text-black">Contact Us</h2>
          <p className="text-center mb-5 text-gray-600">
            Have a question or want to work with us? Fill out the form below and we'll get back to you as soon as possible.
          </p>

          <form action="/contact" method="post" id="contact-form">
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700">Name</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded bg-gray-50"
                id="name"
                name="name"
                placeholder="Your Name"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-700">Email address</label>
              <input
                type="email"
                className="w-full p-2 border border-gray-300 rounded bg-gray-50"
                id="email"
                name="email"
                placeholder="Your Email"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="subject" className="block text-gray-700">Subject</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded bg-gray-50"
                id="subject"
                name="subject"
                placeholder="Subject"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="message" className="block text-gray-700">Message</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded bg-gray-50"
                id="message"
                name="message"
                rows={5}
                placeholder="Your Message"
                required
              ></textarea>
            </div>
            <button type="submit" className="w-full bg-black text-white p-2 rounded hover:bg-gray-800">
              Send Message
            </button>
          </form>

          <div className="text-center mt-5">
            <h5 className="text-xl font-bold text-black">You can also reach us at:</h5>
            <p className="mb-0 text-gray-600">
              <strong>Email:</strong> support@dmpanda.com
            </p>
            <p className="text-gray-600">
              <strong>Phone:</strong> +1 (555) 123-4567
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;