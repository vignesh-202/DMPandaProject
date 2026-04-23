"use client";
import React, { useEffect, useRef, useState } from 'react';

const features = [
  {
    name: 'Inbox Menu',
    description: 'Offer your followers a menu-driven experience in their DMs. Let them choose their path and get instant information about your products or services.',
    useCase: 'Benefit: Provide a structured and interactive way for users to discover what you offer, leading to higher engagement.',
    image: '/images/inbox_menu.png',
  },
  {
    name: 'Super Profile',
    description: 'Create a high-converting link-in-bio page directly from DM Panda. A central hub for all your important links, products, and content.',
    useCase: 'Benefit: Maximize your Instagram traffic by providing a sleek, professional landing page that converts followers into customers.',
    image: '/images/super_profile.png',
  },
  {
    name: 'Conversation Starters',
    description: 'Guide users with pre-set buttons in your Instagram DM inbox, helping them find information or start a conversation effortlessly.',
    useCase: 'Benefit: Act as a 24/7 virtual assistant, answering common questions and guiding potential customers to the right place.',
    image: '/images/conversation_starter.png',
  },
  {
    name: 'Follow-Gated DMs',
    description: 'Make following your account a required step for users to receive your automated DM. A powerful tool for explosive follower growth.',
    useCase: 'Benefit: Convert commenters into loyal followers by making it a prerequisite to receive your giveaway entry or special offer.',
    image: '/images/follow_gated_dm.png',
  },
  {
    name: 'Email Collection in DMs',
    description: 'Ask users for their email within the DM conversation and automatically add it to your mailing list.',
    useCase: 'Benefit: Seamlessly build your email list by turning your Instagram followers into valuable, long-term business leads.',
    image: '/images/email_collector.png',
  },
  {
    name: 'Global Keyword Triggers',
    description: 'Set universal keywords that trigger a specific Auto DM from anywhere on your Instagram—be it a post, Reel, or Story.',
    useCase: 'Benefit: Create powerful, account-wide calls-to-action. A single keyword can now be your master key for lead generation.',
    image: '/images/global_triggers.png',
  },
  {
    name: 'Text Template',
    description: 'Simplicity at its finest. Send a direct, personalized text message response to your users.',
    useCase: 'Benefit: Perfect for quick answers, simple confirmations, or starting a conversation with a warm welcome.',
    image: '/images/text_template.png',
  },
  {
    name: 'Carousel Template',
    description: 'Create stunning visual experiences with carousels of images and buttons. Show off your products in style.',
    useCase: 'Benefit: Drive higher engagement and sales by showcasing your offerings visually with direct links to purchase.',
    image: '/images/carousel_template.png',
  },
  {
    name: 'Button Template',
    description: 'Guide your users with up to three actionable buttons accompanied by a text message.',
    useCase: 'Benefit: Streamline the user journey by offering clear choices, leading them exactly where they want to go.',
    image: '/images/button_template.png',
  },
  {
    name: 'Media Template',
    description: 'Send high-quality images directly in the DM to grab attention instantly.',
    useCase: 'Benefit: Deliver exclusive content, product demos, or special offers in a format that users love to consume.',
    image: '/images/media_template.png',
  },
  {
    name: 'Quick Replies Template',
    description: 'Offer predefined reply options to your users to keep the conversation flowing effortlessly.',
    useCase: 'Benefit: Reduce friction and encourage users to continue engaging with your brand by making it easy to respond.',
    image: '/images/quick_replies_template.png',
  },
  {
    name: 'Share Template',
    description: 'Automatically share your existing Instagram posts or Reels directly in the DM conversation.',
    useCase: 'Benefit: Boost engagement on your latest content by automatically sharing relevant posts or Reels when users engage with your automation.',
    image: '/images/post_share_automation.png',
  },
  {
    name: 'Post Comment Automation',
    description: 'Automatically respond to comments on your Instagram posts. Turn your comments section into an automated lead-capture machine.',
    useCase: 'Benefit: Instantly send a private welcome message or a special link to every user who comments on your Instagram posts.',
    image: '/images/post_comment_dm_reply.png',
  },
  {
    name: 'Post Share Automation',
    description: 'Automatically send a reply from your admin account whenever a user shares one of your posts with you via DM.',
    useCase: 'Benefit: When a user shares your post with you, DMPanda recognizes the interaction and instantly sends an automated reply, perfect for reward delivery and lead capture.',
    image: '/images/post_share_automation.png',
  },
  {
    name: 'Reel Comment Automation',
    description: 'Never miss an opportunity on your viral Reels. DMPanda sends an automated, personalized DM to every single commenter.',
    useCase: 'Benefit: Maximize the impact of your Reels by engaging every commenter, driving traffic and sales directly from your most popular content.',
    image: '/images/reel_comment_dm_reply.png',
  },
  {
    name: 'Reel Share Automation',
    description: 'Engage instantly when users share your Reels with you. DMPanda sends an automatic reply from your account to every user who shares your Reel via DM.',
    useCase: 'Benefit: Turn Reel shares into conversations. When someone shares your Reel to your DMs, they receive an immediate automated response from your account.',
    image: '/images/reel_share_automation.png',
  },
  {
    name: 'Ad Comment Automation',
    description: 'Automatically sends a private DM to every user who comments on your Instagram sponsored posts and ads.',
    useCase: 'Benefit: Get the most out of your ad budget by turning expensive ad comments into valuable, one-on-one sales conversations.',
    image: '/images/sponsored_ad_comment_reply.png',
  },
  {
    name: 'Public Comment Replies',
    description: 'After sending a DM, this feature posts a public reply to the user\'s original comment, creating social proof and encouraging more comments.',
    useCase: 'Benefit: Amplify your engagement by showing everyone that you respond to comments, leading to even more interactions.',
    image: '/images/comment_auto_reply.png',
  },
  {
    name: 'Abusive Comment Moderation',
    description: 'Keep your comments section clean and professional. Automatically hide or delete offensive comments based on your custom keywords.',
    useCase: 'Benefit: Maintain a positive brand image and protect your community from spam and hate speech without manual monitoring.',
    image: '/images/comment_moderation.png',
  },
  {
    name: 'Story Mention Automation',
    description: 'When a user @mentions your account in their Instagram Story, DMPanda instantly sends them a customized thank you DM.',
    useCase: 'Benefit: Encourage more user-generated content by showing instant appreciation whenever someone gives your brand a shoutout.',
    image: '/images/story_mention_dm_reply.png',
  },
  {
    name: 'Suggest More',
    description: 'The "Suggest More" feature lets you auto-send predefined templates, offering users extra product recommendations or information with a simple tap.',
    useCase: 'Benefit: Increase average order value and user satisfaction by proactively offering relevant alternatives or complementary products.',
    image: '/images/suggest_more.png',
  },
];

/* Scroll reveal hook */
const useReveal = (threshold = 0.1) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
};

const FeatureSection = ({ feature, index }: { feature: (typeof features)[0], index: number }) => {
  const { ref, visible } = useReveal();
  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className="group grid md:grid-cols-2 gap-8 sm:gap-12 md:gap-20 lg:gap-32 items-center mb-20 sm:mb-32 lg:mb-40 last:mb-0">
      <div
        className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${isEven ? 'md:order-1' : 'md:order-2'}`}
      >
        <div className="inline-block px-4 py-1.5 mb-4 sm:mb-6 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-[0.15em] uppercase">
          Feature {index + 1}
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white leading-tight tracking-tight">{feature.name}</h2>
        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 leading-relaxed">{feature.description}</p>

        <div className="relative p-5 sm:p-6 bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 dark:bg-blue-400 rounded-r" />
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed italic pl-3">"{feature.useCase}"</p>
        </div>
      </div>

      <div
        className={`transition-all duration-700 ease-out delay-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${isEven ? 'md:order-2' : 'md:order-1'}`}
      >
        <div className="relative aspect-[4/3] md:aspect-square flex items-center justify-center rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] group-hover:border-blue-500/20 dark:group-hover:border-blue-400/20 transition-all duration-500 p-6 sm:p-8 md:p-12 shadow-lg group-hover:shadow-xl dark:shadow-black/20">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/[0.03] via-transparent to-purple-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-700 dark:from-blue-500/[0.05] dark:to-purple-500/[0.05]" />
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <img
              src={feature.image}
              alt={feature.name}
              loading="lazy"
              decoding="async"
              className="max-w-full max-h-full object-contain drop-shadow-lg group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const FeaturesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 sm:pb-24">
        <div className="text-center mb-16 sm:mb-24 lg:mb-32 max-w-4xl mx-auto px-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white tracking-tight leading-[1.1]">
            Your Instagram Automation Powerhouse
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            DMPanda is the ultimate toolkit for growing your brand, capturing leads, and providing 24/7 support—all on Instagram.
          </p>
        </div>

        <div className="space-y-0">
          {features.map((feature, index) => (
            <FeatureSection key={index} feature={feature} index={index} />
          ))}
        </div>

        <div className="mt-20 sm:mt-32 lg:mt-40 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 text-gray-900 dark:text-white">Ready to automate your growth?</h2>
          <a href="/login" className="inline-block bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 sm:px-12 py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0">
            Get Started for Free
          </a>
        </div>
      </div>
    </div>
  );
};

export default FeaturesPage;
