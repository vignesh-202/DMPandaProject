"use client";
import React from 'react';
import { useInView } from 'react-intersection-observer';

const features = [
  {
    name: 'Post Comment Automation',
    description: 'Automatically respond to comments on your Instagram posts. Turn your comments section into an automated lead-capture machine.',
    useCase: 'Benefit: Instantly send a private welcome message or a special link to every user who comments on your Instagram posts.',
    image: '/images/post_comment_dm_reply.png',
  },
  {
    name: 'Reel Comment Automation',
    description: 'Never miss an opportunity on your viral Reels. DMPanda sends an automated, personalized DM to every single commenter.',
    useCase: 'Benefit: Maximize the impact of your Reels by engaging every commenter, driving traffic and sales directly from your most popular content.',
    image: '/images/reel_comment_dm_reply.png',
  },
  {
    name: 'Story Reply Automation',
    description: 'Instantly reply to your followers\' reactions and messages on your Instagram Stories, 24/7.',
    useCase: 'Benefit: Build a loyal community by making every follower feel heard and appreciated, without lifting a finger.',
    image: '/images/story_reply_dm_reply.png',
  },
  {
    name: 'Story Mention Automation',
    description: 'When a user @mentions your account in their Instagram Story, DMPanda instantly sends them a customized thank you DM.',
    useCase: 'Benefit: Encourage more user-generated content by showing instant appreciation whenever someone gives your brand a shoutout.',
    image: '/images/story_mention_dm_reply.png',
    imageMaxWidth: '405px',
  },
  {
    name: 'Conversation Starters',
    description: 'Guide users with pre-set buttons in your Instagram DM inbox, helping them find information or start a conversation effortlessly.',
    useCase: 'Benefit: Act as a 24/7 virtual assistant, answering common questions and guiding potential customers to the right place.',
    image: '/images/conversation_starter.png',
  },
  {
    name: 'Ad Comment Automation',
    description: 'Automatically sends a private DM to every user who comments on your Instagram sponsored posts and ads.',
    useCase: 'Benefit: Get the most out of your ad budget by turning expensive ad comments into valuable, one-on-one sales conversations.',
    image: '/images/sponsored_ad_comment_reply.png',
  },
  {
    name: 'Follow-Gated DMs',
    description: 'Make following your account a required step for users to receive your automated DM. A powerful tool for explosive follower growth.',
    useCase: 'Benefit: Convert commenters into loyal followers by making it a prerequisite to receive your giveaway entry, link, or special offer.',
    image: '/images/follow_gated_dm.png',
    imageMaxWidth: '284px',
  },
  {
    name: 'Public Comment Replies',
    description: 'After sending a DM, this feature posts a public reply to the user\'s original comment, creating social proof and encouraging more comments.',
    useCase: 'Benefit: Amplify your engagement by showing everyone that you respond to comments, leading to even more interactions.',
    image: '/images/comment_auto_reply.png',
    imageMaxWidth: '281px',
  },
  {
    name: 'DM Retry System',
    description: 'If any DMs fail during a viral event, SendBack automatically re-processes them, ensuring no lead is ever left behind.',
    useCase: 'Benefit: Go viral with confidence. Panda SendBack guarantees a 100% response rate, even when your post gets thousands of comments.',
    image: '/images/dm_automation.png',
    imageMaxWidth: '284px',
  },
  {
    name: 'High-Traffic DM Queue',
    description: 'When your posts get a flood of comments, our system securely queues every interaction and sends DMs in an orderly fashion.',
    useCase: 'Benefit: Protect your account and ensure reliable delivery during high-traffic moments, without any data loss or delays.',
    image: '/images/dm_queue.png',
  },
  {
    name: 'Global Keyword Triggers',
    description: 'Set universal keywords that trigger a specific Auto DM from anywhere on your Instagram—be it a post, Reel, or Story.',
    useCase: 'Benefit: Create powerful, account-wide calls-to-action. A single keyword can now be your master key for lead generation.',
    image: '/images/global_triggers.png',
  },
  {
    name: 'Email Collection in DMs',
    description: 'Ask users for their email within the DM conversation and automatically add it to your mailing list.',
    useCase: 'Benefit: Seamlessly build your email list by turning your Instagram followers into valuable, long-term business leads.',
    image: '/images/email_collector.png',
    imageMaxWidth: '284px',
  },
];

const FeatureSection = ({ feature, index }: { feature: (typeof features)[0] & { imageMaxWidth?: string, imageClassName?: string }, index: number }) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.3,
  });

  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
      {/* Text Content */}
      <div
        className={`transition-opacity duration-1000 ${inView ? 'opacity-100' : 'opacity-0'} ${isEven ? 'md:order-1' : 'md:order-2'}`}
      >
        <h2 className="text-3xl font-bold mb-4 text-gray-900">{feature.name}</h2>
        <p className="text-lg text-gray-700 mb-4 leading-relaxed">{feature.description}</p>
        <p className="text-md text-gray-500 italic">{feature.useCase}</p>
      </div>

      {/* Image Content */}
      <div 
        className={`transition-all duration-1000 transform ${inView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${isEven ? 'md:order-2' : 'md:order-1'}`}
      >
        <img
          src={feature.image}
          alt={feature.name}
          className={`mx-auto ${feature.imageClassName || ''}`}
          style={{
            width: '100%',
            height: 'auto',
            maxWidth: feature.imageMaxWidth || '450px'
          }}
        />
      </div>
    </div>
  );
};

const FeaturesPage: React.FC = () => {
  return (
    <div className="bg-white text-gray-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-28 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 text-gray-900">
            Your Instagram Automation Powerhouse
          </h1>
          <p className="text-xl text-gray-600">
            DMPanda is the ultimate toolkit for growing your brand, capturing leads, and providing 24/7 support—all on Instagram.
          </p>
        </div>

        <div className="space-y-28">
          {features.map((feature, index) => (
            <FeatureSection key={index} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturesPage;