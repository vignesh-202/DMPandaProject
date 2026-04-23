import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 sm:pb-24 max-w-5xl">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-4 sm:mb-6 tracking-tight text-gray-900 dark:text-white">About DM Panda</h1>
        <p className="text-base sm:text-lg lg:text-xl text-center text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12 sm:mb-16 leading-relaxed">
          Your partner in automating Instagram direct messages efficiently and effectively.
        </p>

        <div className="grid md:grid-cols-2 gap-8 sm:gap-12 mb-14 sm:mb-20">
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold border-l-4 border-gray-900 dark:border-white pl-4 text-gray-900 dark:text-white">Our Mission</h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              Our mission is to empower businesses and individuals to streamline their Instagram outreach and engagement
              through intelligent automation. We believe in saving you time so you can focus on what matters most –
              building meaningful connections.
            </p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold border-l-4 border-gray-900 dark:border-white pl-4 text-gray-900 dark:text-white">Our Story</h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              DM Panda was founded by a team of social media enthusiasts and software engineers who saw the need for a
              smarter, more intuitive way to manage Instagram DMs at scale. Frustrated by the limitations of existing
              tools, we set out to build a platform that is both powerful and easy to use.
            </p>
          </div>
        </div>

        <div className="mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 text-gray-900 dark:text-white">What We Offer</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[
              { icon: '⚙️', title: 'Smart Automation', desc: 'Powerful automated message sequences that work while you sleep.' },
              { icon: '👥', title: 'Audience Segmentation', desc: 'Advanced targeting to reach exactly the right people at the right time.' },
              { icon: '📊', title: 'Detailed Analytics', desc: 'Comprehensive insights to track performance and optimize your strategy.' },
            ].map((item, i) => (
              <div key={i} className="p-6 sm:p-8 rounded-2xl bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-300 border border-gray-100 dark:border-white/[0.06] hover:-translate-y-1">
                <div className="text-3xl mb-4 sm:mb-6">{item.icon}</div>
                <h4 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-900 dark:text-white">{item.title}</h4>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-gray-500 dark:text-gray-500 mt-12 sm:mt-16 italic text-sm sm:text-base">
          Thank you for choosing DM Panda. We're excited to help you grow your presence on Instagram!
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
