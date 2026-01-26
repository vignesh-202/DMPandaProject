import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <div className="container mx-auto py-5 bg-white">
      <h1 className="mb-4 text-center text-4xl font-bold text-black">About DM Panda</h1>
      <p className="text-lg text-center text-gray-600">
        Welcome to DM Panda, your partner in automating Instagram direct messages efficiently and effectively.
      </p>

      <div className="flex flex-wrap mt-5">
        <div className="w-full md:w-1/2 pr-4">
          <h2 className="text-2xl font-bold text-black">Our Mission</h2>
          <p className="text-gray-600">
            Our mission is to empower businesses and individuals to streamline their Instagram outreach and engagement
            through intelligent automation. We believe in saving you time so you can focus on what matters most –
            building meaningful connections.
          </p>
        </div>
        <div className="w-full md:w-1/2 pl-4">
          <h2 className="text-2xl font-bold text-black">Our Story</h2>
          <p className="text-gray-600">
            DM Panda was founded by a team of social media enthusiasts and software engineers who saw the need for a
            smarter, more intuitive way to manage Instagram DMs at scale. Frustrated by the limitations of existing
            tools, we set out to build a platform that is both powerful and easy to use.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="text-center mb-4 text-3xl font-bold text-black">What We Offer</h2>
        <div className="flex flex-wrap">
          <div className="w-full md:w-1/3 p-2">
            <div className="card text-center p-3 h-full shadow-lg rounded-lg bg-gray-50">
              <i className="fas fa-cogs fa-3x text-black mb-3"></i>
              <h4 className="text-xl font-bold text-black">Smart Automation</h4>
              <p className="text-gray-600">Smart automated message sequences</p>
            </div>
          </div>
          <div className="w-full md:w-1/3 p-2">
            <div className="card text-center p-3 h-full shadow-lg rounded-lg bg-gray-50">
              <i className="fas fa-users fa-3x text-black mb-3"></i>
              <h4 className="text-xl font-bold text-black">Audience Segmentation</h4>
              <p className="text-gray-600">Advanced audience segmentation</p>
            </div>
          </div>
          <div className="w-full md:w-1/3 p-2">
            <div className="card text-center p-3 h-full shadow-lg rounded-lg bg-gray-50">
              <i className="fas fa-chart-line fa-3x text-black mb-3"></i>
              <h4 className="text-xl font-bold text-black">Detailed Analytics</h4>
              <p className="text-gray-600">Detailed performance analytics</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-gray-600">
        Thank you for choosing DM Panda. We're excited to help you grow your presence on Instagram!
      </p>
    </div>
  );
};

export default AboutPage;