import React from 'react';
import FlippingText from '../../components/ui/FlippingText';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCommentDots,
  faPaperPlane,
  faComments,
  faShare,
  faFilm,
  faVideo,
  faShareAlt,
  faEnvelopeOpenText,
  faAt,
  faReply,
  faCogs,
  faUserFriends,
  faLink,
  faBroadcastTower,
  faGift,
  faBolt,
  faUsersCog,
  faChartLine,
  faPlug,
  faSlidersH,
  faRocket,
} from '@fortawesome/free-solid-svg-icons';

const HomePage: React.FC = () => {
  const animatedTexts = [
    "Automate Your Instagram DM's",
    "No Facebook page needed",
    "Cheapest DM service in the market",
  ];

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero-section py-10 bg-gray-50">
        <div className="container mx-auto px-8">
          <div className="flex flex-col md:flex-row items-center justify-center">
            <div className="md:w-1/2 text-center md:text-left mb-10 md:mb-0 md:pl-8 lg:pl-24">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4 text-gray-900 animate-fade-in-up">
                <FlippingText
                  texts={animatedTexts}
                  duration={3000}
                  className="block"
                  highlightWords={{
                    "Instagram": "text-instagram-red",
                    "Facebook": "text-facebook"
                  }}
                />
              </h1>
              <p className="text-xl sm:text-2xl md:text-3xl text-gray-700 mb-6 animate-fade-in-up delay-100">
                Save time with DM Panda's intelligent automation.
              </p>
              <AuthRedirectButton className="inline-block bg-black hover:bg-gray-800 text-white font-bold py-4 px-10 sm:py-5 sm:px-12 rounded-2xl transition duration-300 ease-in-out transform hover:scale-105 animate-fade-in-up delay-200 text-base sm:text-lg">
                Get Started for Free
              </AuthRedirectButton>
              <p className="text-gray-500 text-base mt-3 animate-fade-in-up delay-300">
                No credit card required
              </p>
              <div className="mt-8 flex items-center justify-center md:justify-start animate-fade-in-up delay-400">
                <img
                  src="/images/indian_flag.png"
                  alt="Indian Flag"
                  className="h-6 mr-3"
                />
                <p className="text-gray-600 font-semibold text-lg">
                  Made in India
                </p>
              </div>
              <div className="mt-6 animate-fade-in-up delay-500">
                <img
                  src="/images/Meta_Business_logo.png"
                  alt="Meta Business Partner"
                  className="max-h-24 mx-auto md:mx-0" style={{ transform: 'scale(0.95)' }}
                />
              </div>
            </div>
            <div className="md:w-1/2 text-center">
              <img
                src="/images/hero_image.png"
                alt="DM Panda Illustration"
                className="w-full max-w-2xl mx-auto animate-float" style={{ transform: 'scale(0.9)' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section py-12 bg-white">
        <div className="container mx-auto px-8 max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="stat-item p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-3xl font-bold text-gray-900">22,000+</h3>
              <p className="text-gray-600">Happy DM Panda Users</p>
            </div>
            <div className="stat-item p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-3xl font-bold text-gray-900">120 Million+</h3>
              <p className="text-gray-600">Automated DMs Sent</p>
            </div>
            <div className="stat-item p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-3xl font-bold text-gray-900">95%</h3>
              <p className="text-gray-600">Inbox Response Rate</p>
            </div>
            <div className="stat-item p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-3xl font-bold text-gray-900">10x</h3>
              <p className="text-gray-600">Engagement Increase</p>
            </div>
          </div>
        </div>
      </section>

      {/* Made in India Section */}
      <section className="made-in-india-section py-6 bg-gray-50">
        <div className="container mx-auto px-8 max-w-7xl">
          <p className="text-lg md:text-xl font-semibold text-gray-700 mb-2 text-center">
            <img
              src="/images/indian_flag.png"
              alt="Indian Flag"
              className="h-6 inline-block mr-2"
            />
            Crafted with passion in India
          </p>
          <p className="text-sm text-gray-500 text-center">
            Empowering global businesses with innovative automation solutions, proudly made in India.
          </p>
        </div>
      </section>

      {/* Meta Business Partner Section */}
      <section className="meta-partner-section py-12 bg-white">
        <div className="container mx-auto px-8 max-w-7xl">
          <div className="flex justify-center">
            <div className="w-full">
              <div className="bg-gray-100 p-8 rounded-lg shadow-xl">
                <div className="flex flex-col lg:flex-row items-center justify-between">
                  <div className="md:w-2/3 text-center md:text-left mb-6 md:mb-0">
                    <h6 className="text-black font-bold mb-2">
                      BADGED PARTNER
                    </h6>
                    <h3 className="text-3xl font-bold mb-3 text-gray-900">
                      DM Panda is a Meta Business Partner
                    </h3>
                    <p className="text-gray-700">
                      We've been a certified Meta Business Partner since 2021,
                      offering peace of mind to our 22,000+ users by ensuring
                      complete compliance with automation standards across
                      Instagram.
                    </p>
                  </div>
                  <div className="md:w-1/3 text-center">
                    <img
                      src="/images/Meta_Business_logo.png"
                      alt="Meta Business Partner"
                      className="max-h-24 mx-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* All Features Section */}
      <section className="insta-features-section py-20 bg-gray-50">
        <div className="container mx-auto px-8 max-w-7xl">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-gray-900">
            A Complete Suite of Automation Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {[
              {
                icon: faCommentDots,
                title: 'Post Comment Reply',
                description: 'Automatically reply to comments on your posts.',
              },
              {
                icon: faPaperPlane,
                title: 'Post Comment to DM',
                description: 'Send a DM to users who comment on your posts.',
              },
              {
                icon: faComments,
                title: 'Post Comment Reply + DM',
                description: 'Reply to a comment and send a DM simultaneously.',
              },
              {
                icon: faShare,
                title: 'Post Share to DM',
                description: 'Send a DM to users who share your posts.',
              },
              {
                icon: faFilm,
                title: 'Reel Comment Reply',
                description: 'Automatically reply to comments on your Reels.',
              },
              {
                icon: faVideo,
                title: 'Reel Comment to DM',
                description: 'Send a DM to users who comment on your Reels.',
              },
              {
                icon: faFilm,
                title: 'Reel Comment Reply + DM',
                description: 'Reply to a Reel comment and send a DM.',
              },
              {
                icon: faShareAlt,
                title: 'Reel Share to DM',
                description: 'Send a DM to users who share your Reels.',
              },
              {
                icon: faEnvelopeOpenText,
                title: 'Automated DM Reply',
                description: 'Automatically reply to incoming DMs.',
              },
              {
                icon: faAt,
                title: 'Story Mention to DM',
                description: 'Send a DM when a user mentions you in their Story.',
              },
              {
                icon: faReply,
                title: 'Story Reply to DM',
                description: 'Automatically reply to users who reply to your Story.',
              },
              {
                icon: faCogs,
                title: 'Custom Webhook',
                description:
                  'Get user IDs from mentions, comments, replies, and DMs sent to your custom webhook.',
              },
              {
                icon: faUserFriends,
                title: 'Followers Only',
                description:
                  'Set automation for only followers of your account or for anyone.',
              },
              {
                icon: faLink,
                title: 'Button Template for Links',
                description: 'Use interactive buttons in your DMs to guide users to links.',
              },
              {
                icon: faBroadcastTower,
                title: 'Instagram Live Automation',
                description: 'Automate interactions during Instagram Live sessions.',
              },
              {
                icon: faGift,
                title: 'Giveaway for Followers',
                description: 'Run exclusive giveaways for your Instagram followers.',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="card h-full text-center shadow-xl rounded-2xl p-8 bg-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl md:flex-col"
              >
                <div className="card-body">
                  <div className="feature-icon mb-6 text-5xl text-black">
                    <FontAwesomeIcon icon={feature.icon} />
                  </div>
                  <h5 className="card-title font-bold text-2xl mb-3 text-gray-900">
                    {feature.title}
                  </h5>
                  <p className="card-text text-lg text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose DM Panda Section */}
      <section className="features-section py-20 bg-white">
        <div className="container mx-auto px-8 max-w-7xl">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-gray-900">
            Why Choose DM Panda?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                icon: faBolt,
                title: 'Smart Automation',
                description:
                  'Set up automated message sequences based on triggers and user interactions.',
              },
              {
                icon: faUsersCog,
                title: 'Audience Segmentation',
                description:
                  'Target specific user groups with personalized messages for better engagement.',
              },
              {
                icon: faChartLine,
                title: 'Performance Analytics',
                description:
                  'Track your campaign performance with detailed analytics and reports.',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="feature-item p-8 rounded-2xl shadow-xl bg-gray-50 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div className="feature-icon mb-6 text-5xl text-black">
                  <FontAwesomeIcon icon={feature.icon} />
                </div>
                <h4 className="text-3xl font-bold mb-3 text-gray-900">
                  {feature.title}
                </h4>
                <p className="text-lg text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section py-20 bg-gray-50">
        <div className="container mx-auto px-8 max-w-7xl">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-gray-900">
            Get Started in 3 Simple Steps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                icon: faPlug,
                title: 'Connect Account',
                description: 'Securely link your Instagram account to DM Panda.',
              },
              {
                icon: faSlidersH,
                title: 'Set Up Campaigns',
                description: 'Define your target audience and create your message sequences.',
              },
              {
                icon: faRocket,
                title: 'Launch & Monitor',
                description: 'Start your automation and track results through the dashboard.',
              },
            ].map((step, index) => (
              <div
                key={index}
                className="step-item p-8 rounded-2xl shadow-xl bg-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div className="feature-icon mb-6 text-5xl text-black">
                  <FontAwesomeIcon icon={step.icon} />
                </div>
                <h4 className="text-3xl font-bold mb-3 text-gray-900">
                  {step.title}
                </h4>
                <p className="text-lg text-gray-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero Section with Image and Content */}
      <section className="hero-section-alt py-16 bg-white">
        <div className="container mx-auto px-8 max-w-7xl">
          <div className="flex flex-col md:flex-row-reverse items-center justify-center">
            <div className="md:w-1/2 text-center md:text-left mb-10 md:mb-0 md:pr-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 text-gray-900">
                Visualize Your Auto Workflow
              </h2>
              <p className="text-lg sm:text-xl md:text-2xl text-gray-700 mb-6">
                See how DM Panda automates your Instagram interactions seamlessly.
              </p>
              <AuthRedirectButton className="inline-block bg-black hover:bg-gray-800 text-white font-bold py-3 px-8 rounded-2xl transition duration-300 ease-in-out transform hover:scale-105">
                Get Started
              </AuthRedirectButton>
            </div>
            <div className="md:w-1/2 text-center">
              <img
                src="/images/mobile_screen.png"
                alt="Responsive Mobile Screen"
                className="w-full max-w-lg mx-auto animate-float-up-down"
                style={{ maxHeight: '600px' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Automation Showcase Section */}
      <section className="automation-showcase py-16 bg-gray-50">
        <div className="container mx-auto px-8 max-w-7xl">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 text-gray-900">
            Explore the Power of DMPanda
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center">
            <div className="md:w-1/2 text-center md:text-left mb-10 md:mb-0 md:pr-16">
              <h3 className="text-2xl font-bold leading-tight mb-4 text-gray-900">
                Full-Suite Instagram Automation
              </h3>
              <p className="text-lg sm:text-xl md:text-2xl text-gray-700 mb-6">
                From auto-replying to comments and story mentions to running giveaways and capturing leads, DMPanda provides a complete toolkit to put your Instagram engagement on autopilot. Discover how our features can save you time and grow your brand.
              </p>
              <Link to="/features" className="inline-block bg-black hover:bg-gray-800 text-white font-bold py-3 px-8 rounded-2xl transition duration-300 ease-in-out transform hover:scale-105">
                See All Features
              </Link>
            </div>
            <div className="md:w-1/2 text-center">
              <img
                src="/images/workflow.png"
                alt="Automation Workflow"
                className="w-full h-auto rounded-lg shadow-lg"
                style={{ maxWidth: '600px' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="cta-section py-12 bg-black text-white text-center">
        <div className="container mx-auto px-8 max-w-7xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Boost Your Instagram Engagement?
          </h2>
          <p className="text-lg sm:text-xl mb-6">
            Join DM Panda today and start automating your DMs like a pro.
          </p>
          <AuthRedirectButton className="inline-block bg-white text-black font-bold py-3 px-8 rounded-2xl transition duration-300 ease-in-out transform hover:scale-105">
            Sign Up Now
          </AuthRedirectButton>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
