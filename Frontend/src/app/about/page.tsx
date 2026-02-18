import React, { useEffect } from 'react';

const AboutPage: React.FC = () => {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    return () => {
      // Cleanup handled by next page or theme provider
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-6 tracking-tight">About DM Panda</h1>
        <p className="text-xl text-center text-gray-600 max-w-3xl mx-auto mb-16 leading-relaxed">
          Your partner in automating Instagram direct messages efficiently and effectively.
        </p>

        <div className="grid md:grid-cols-2 gap-12 mb-20">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold border-l-4 border-black pl-4">Our Mission</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Our mission is to empower businesses and individuals to streamline their Instagram outreach and engagement
              through intelligent automation. We believe in saving you time so you can focus on what matters most –
              building meaningful connections.
            </p>
          </div>
          <div className="space-y-6">
            <h2 className="text-3xl font-bold border-l-4 border-black pl-4">Our Story</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              DM Panda was founded by a team of social media enthusiasts and software engineers who saw the need for a
              smarter, more intuitive way to manage Instagram DMs at scale. Frustrated by the limitations of existing
              tools, we set out to build a platform that is both powerful and easy to use.
            </p>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-12">What We Offer</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors duration-300">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-6 text-xl">
                <i className="fas fa-cogs"></i>
              </div>
              <h4 className="text-xl font-bold mb-3">Smart Automation</h4>
              <p className="text-gray-600">Powerful automated message sequences that work while you sleep.</p>
            </div>
            <div className="p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors duration-300">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-6 text-xl">
                <i className="fas fa-users"></i>
              </div>
              <h4 className="text-xl font-bold mb-3">Audience Segmentation</h4>
              <p className="text-gray-600">Advanced targeting to reach exactly the right people at the right time.</p>
            </div>
            <div className="p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors duration-300">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-6 text-xl">
                <i className="fas fa-chart-line"></i>
              </div>
              <h4 className="text-xl font-bold mb-3">Detailed Analytics</h4>
              <p className="text-gray-600">Comprehensive insights to track performance and optimize your strategy.</p>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-500 mt-16 italic">
          Thank you for choosing DM Panda. We're excited to help you grow your presence on Instagram!
        </p>
      </div>
    </div>
  );
};

export default AboutPage;