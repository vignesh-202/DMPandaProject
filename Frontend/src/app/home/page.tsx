import React, { useState, useRef, useCallback, useEffect } from 'react';
import FlippingText from '../../components/ui/FlippingText';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
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
  faBolt,
  faUsersCog,
  faChartLine,
  faPlug,
  faSlidersH,
  faRocket,
} from '@fortawesome/free-solid-svg-icons';

/* ==========================================
   Dashboard Hero - Interactive 3D Flip Frame
   ========================================== */
const DashboardAppFrame = ({ mode, src, label }: { mode: 'light' | 'dark'; src: string; label: string }) => {
  const isDark = mode === 'dark';
  return (
    <div className={`w-full h-full rounded-[20px] sm:rounded-[28px] overflow-hidden border ${isDark ? 'bg-neutral-950 border-white/10' : 'bg-white border-black/5'} shadow-[0_24px_60px_-24px_rgba(15,23,42,0.3)] dark:shadow-[0_24px_70px_-20px_rgba(99,102,241,0.2)] flex flex-col pointer-events-none`}>
      {/* Window Header */}
      <div className={`flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b ${isDark ? 'border-white/5 bg-[#171717]' : 'border-black/5 bg-[#F9FAFB]'}`}>
        {/* Mac OS Style Dots */}
        <div className="flex gap-1.5 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/30" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/30" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/30" />
        </div>

        {/* Address bar mockup */}
        <div className={`hidden sm:flex flex-1 mx-6 items-center justify-center max-w-[240px] rounded-md px-2 py-1 text-[10px] font-medium tracking-wide ${isDark ? 'bg-black/60 text-gray-400 border border-white/5' : 'bg-white shadow-sm border border-gray-200 text-gray-500'}`}>
           <FontAwesomeIcon icon={faLink} className="mr-1.5 opacity-50 text-[9px]" /> dmpanda.com/dashboard
        </div>
      </div>

      {/* Content Body */}
      <div className={`relative flex-1 w-full p-2 sm:p-4 flex items-center justify-center ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F1F5F9]'}`}>
         {/* Subtle internal gradient glow */}
         <div className={`absolute inset-0 opacity-40 mix-blend-screen pointer-events-none ${isDark ? 'bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.12),transparent_60%)]' : 'bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1),transparent_60%)]'}`} />

         <img
            src={src}
            alt={label}
            className={`relative z-10 w-full h-auto object-contain rounded-lg sm:rounded-xl shadow-lg border ${isDark ? 'border-white/10' : 'border-black/5'}`}
            loading="eager"
         />
      </div>
    </div>
  );
};

const DashboardHero: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [swapped, setSwapped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  /* Gentle Mouse tilt */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = containerRef.current!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxTilt = 4;
      const rawX = ((e.clientY - cy) / (rect.height / 2)) * maxTilt;
      const rawY = -((e.clientX - cx) / (rect.width / 2)) * maxTilt;
      setTilt({
        x: Math.max(-maxTilt, Math.min(maxTilt, rawX)),
        y: Math.max(-maxTilt, Math.min(maxTilt, rawY)),
      });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ x: 0, y: 0 });
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const handleSwitch = () => {
    setSwapped((prev) => !prev);
  };

  const primaryMode = swapped
    ? (isDarkMode ? 'dark' : 'light')
    : (isDarkMode ? 'light' : 'dark');

  const accentGlow = primaryMode === 'dark'
    ? 'radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.7) 0%, rgba(99,102,241,0.5) 45%, rgba(59,130,246,0.2) 65%, transparent 85%)'
    : 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.65) 0%, rgba(14,165,233,0.4) 45%, rgba(34,197,94,0.15) 65%, transparent 85%)';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleSwitch}
      className="relative w-full max-w-[46rem] mx-auto cursor-pointer select-none group focus:outline-none"
      style={{ perspective: '2000px' }}
      title="Click to flip dashboard"
    >
      {/* Background ambient glow matching current mode */}
      <div
        className="absolute inset-0 -inset-x-12 -inset-y-12 rounded-[5rem] pointer-events-none opacity-100 mix-blend-screen dark:mix-blend-lighten"
        style={{
          background: accentGlow,
          filter: 'blur(60px)',
          transform: `translateZ(-100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'background 700ms ease-in-out, transform 75ms ease-out'
        }}
      />

      {/* Real-time Mouse Tracking Container */}
      <div
        className="relative w-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 75ms ease-out'
        }}
      >
        {/* 3D Flipping Container */}
        <div
          className="relative w-full transition-transform ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
              transitionDuration: '900ms',
              transformStyle: 'preserve-3d',
              transform: `rotateY(${swapped ? 180 : 0}deg)`
          }}
        >
          {/* Front Card */}
          <div
              className="w-full relative origin-center"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
             <DashboardAppFrame
               mode={isDarkMode ? 'light' : 'dark'}
               src={isDarkMode ? '/images/dashboard_light.png' : '/images/dashboard_dark.png'}
               label={isDarkMode ? 'Light Dash' : 'Dark Dash'}
             />
          </div>

          {/* Back Card */}
          <div
              className="w-full absolute inset-0 h-full origin-center"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
             <DashboardAppFrame
               mode={isDarkMode ? 'dark' : 'light'}
               src={isDarkMode ? '/images/dashboard_dark.png' : '/images/dashboard_light.png'}
               label={isDarkMode ? 'Dark Dash' : 'Light Dash'}
             />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   Scroll-reveal hook
   ========================================== */
const useReveal = (threshold = 0.15) => {
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

const RevealSection: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({
  children,
  className = '',
  delay = 0,
}) => {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

/* ==========================================
   Home Page
   ========================================== */
const HomePage: React.FC = () => {
  const animatedTexts = [
    "Automate Your Instagram DM's",
    "No Facebook page needed",
    "Cheapest DM service ever",
  ];

  return (
    <div className="homepage relative bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 transition-colors duration-500 overflow-hidden">

      {/* Instagram gradient space dust crossing behind the logo */}
      {/* Light mode */}
      <div className="absolute -top-10 left-0 w-[1200px] h-[800px] pointer-events-none z-0 dark:hidden" style={{
        background: 'radial-gradient(ellipse at 10% 10%, rgba(150,47,191,0.12) 0%, rgba(214,41,118,0.09) 20%, rgba(245,96,64,0.06) 40%, rgba(252,175,69,0.04) 55%, transparent 70%)',
        filter: 'blur(60px)',
      }} />
      {/* Dark mode - slightly brighter */}
      <div className="absolute -top-10 left-0 w-[1200px] h-[800px] pointer-events-none z-0 hidden dark:block" style={{
        background: 'radial-gradient(ellipse at 10% 10%, rgba(150,47,191,0.18) 0%, rgba(214,41,118,0.12) 20%, rgba(245,96,64,0.08) 40%, rgba(252,175,69,0.05) 55%, transparent 70%)',
        filter: 'blur(70px)',
      }} />

      {/* ===== HERO ===== */}
      <section
        className="relative flex items-center justify-center overflow-hidden"
        style={{ minHeight: 'calc(100dvh - 5rem)' }}
      >
        {/* Ambient background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-500/[0.06] dark:bg-purple-500/[0.08] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/[0.05] dark:bg-blue-500/[0.06] rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10 pb-6 pt-10 mt-8 lg:mt-[8vh]">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-12 items-center">
            {/* Left - Text */}
            <div className="text-center lg:text-left">
              <RevealSection>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] xl:text-6xl font-bold leading-[1.1] mb-5 text-gray-900 dark:text-white">
                  <FlippingText
                    texts={animatedTexts}
                    duration={3000}
                    className="block"
                    highlightWords={{
                      "Instagram": "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] bg-clip-text text-transparent",
                      "Facebook": "text-facebook",
                      "DM ": "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] bg-clip-text text-transparent"
                    }}
                  />
                </h1>
              </RevealSection>

              <RevealSection delay={100}>
                <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-7 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                  Save time with DM Panda's intelligent automation.
                </p>
              </RevealSection>

              <RevealSection delay={200}>
                <AuthRedirectButton className="inline-block bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-200 hover:from-gray-800 hover:to-gray-700 dark:hover:from-gray-100 dark:hover:to-white text-white dark:text-gray-900 font-bold py-3.5 px-8 sm:py-4 sm:px-10 rounded-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-black/10 dark:shadow-white/10 text-sm sm:text-base">
                  Get Started for Free
                </AuthRedirectButton>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-3">
                  No credit card required
                </p>
              </RevealSection>

              <RevealSection delay={300}>
                <div className="mt-6 flex items-center justify-center lg:justify-start gap-3">
                  <img src="/images/indian_flag.png" alt="Indian Flag" className="h-5" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Made in India</p>
                </div>
              </RevealSection>

              <RevealSection delay={400}>
                <div className="mt-5">
                  <img
                    src="/images/Meta_Business_logo.png"
                    alt="Meta Business Partner"
                    className="h-14 sm:h-16 w-auto mx-auto lg:mx-0 transition-all duration-300"
                  />
                </div>
              </RevealSection>
            </div>

            {/* Right - Dashboard Images */}
            <RevealSection delay={200} className="flex items-center justify-center">
              <DashboardHero />
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="py-12 sm:py-16 bg-gray-50/80 dark:bg-white/[0.02] border-y border-gray-100 dark:border-white/[0.04]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {[
              { value: '22,000+', label: 'Happy Users' },
              { value: '120M+', label: 'Messages Sent' },
              { value: '95%', label: 'Response Rate' },
              { value: '10x', label: 'More Engagement' },
            ].map((stat, i) => (
              <RevealSection key={i} delay={i * 80}>
                <div className="text-center p-4 sm:p-6 rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] hover:shadow-lg dark:hover:shadow-white/[0.02] transition-all duration-300 hover:-translate-y-1">
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{stat.label}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MADE IN INDIA ===== */}
      <section className="py-8 sm:py-10 bg-white dark:bg-neutral-950">
        <RevealSection>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl text-center">
            <p className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
              <img src="/images/indian_flag.png" alt="Indian Flag" className="h-5 inline-block mr-2" />
              Crafted with passion in India
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Empowering global businesses with innovative automation solutions, proudly made in India.
            </p>
          </div>
        </RevealSection>
      </section>

      {/* ===== META PARTNER ===== */}
      <section className="py-12 sm:py-16 bg-gray-50/60 dark:bg-white/[0.015]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <RevealSection>
            <div className="bg-white dark:bg-white/[0.04] p-6 sm:p-10 rounded-3xl border border-gray-100 dark:border-white/[0.06] shadow-xl dark:shadow-black/20">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="text-center lg:text-left">
                  <p className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-2">
                    Badged Partner
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-gray-900 dark:text-white">
                    DM Panda is a Meta Business Partner
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">
                    We've been a certified Meta Business Partner since 2021,
                    offering peace of mind to our 22,000+ users by ensuring
                    complete compliance with automation standards across
                    Instagram.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <img
                    src="/images/Meta_Business_logo.png"
                    alt="Meta Business Partner"
                    className="max-h-20"
                  />
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== AUTOMATION TOOLS GRID ===== */}
      <section className="py-16 sm:py-24 bg-white dark:bg-neutral-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <RevealSection>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-12 sm:mb-16 text-gray-900 dark:text-white">
              A Complete Suite of Automation Tools
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: faLink, title: 'Button Template for Links', description: 'Send template-driven DM replies with tappable buttons that route people to links, offers, or the next step.' },
              { icon: faUsersCog, title: 'Super Profile', description: 'Create a public link-in-bio page with branded buttons, icons, and ordered links for your Instagram account.' },
              { icon: faCogs, title: 'Inbox Menu', description: 'Manage your Instagram persistent menu, sync it with Instagram, and link menu items to URLs or automation actions.' },
              { icon: faEnvelopeOpenText, title: 'Welcome Message', description: 'Set a fallback welcome reply that runs when no other automation or global trigger matches first.' },
              { icon: faReply, title: 'Convo Starters', description: 'Publish up to four conversation starters in Instagram DMs and attach template-based replies to each one.' },
              { icon: faBolt, title: 'Global Trigger', description: 'Use one account-wide keyword to trigger the same response flow across comments, stories, DMs, and live.' },
              { icon: faEnvelopeOpenText, title: 'Automated DM Reply', description: 'Build keyword-based DM automations with template replies, follow-gates, and optional Suggest More follow-ups.' },
              { icon: faCommentDots, title: 'Post Comment Reply', description: 'Post a public comment reply when a post-comment automation matches, so the response is visible on the post too.' },
              { icon: faPaperPlane, title: 'Post Comment to DM', description: 'Trigger private DM replies from post comments using keywords or all-comments mode on your selected post.' },
              { icon: faComments, title: 'Post Comment Reply + DM', description: 'Combine a public comment reply with a private DM from the same post-comment automation flow.' },
              { icon: faShare, title: 'Post Share to DM', description: 'Send an automated follow-up when someone shares your post into Instagram DMs.' },
              { icon: faFilm, title: 'Reel Comment Reply', description: 'Reply publicly on Reel comments when a Reel automation matches your trigger setup.' },
              { icon: faVideo, title: 'Reel Comment to DM', description: 'Turn Reel comments into private DM conversations with keyword or all-comments triggers.' },
              { icon: faFilm, title: 'Reel Comment Reply + DM', description: 'Run both the public comment reply and the private DM when users comment on a Reel.' },
              { icon: faShareAlt, title: 'Reel Share to DM', description: 'Respond automatically when someone shares your Reel into DMs and keep that intent moving forward.' },
              { icon: faAt, title: 'Story Mention to DM', description: 'Send a template-based DM when someone mentions your account in their Instagram Story.' },
              { icon: faReply, title: 'Story Reply to DM', description: 'Reply to active Story responses with DM automations while the Story is still live.' },
              { icon: faBroadcastTower, title: 'Instagram Live Automation', description: 'Prepare live comment automations in advance with one all-comments rule, up to five keywords, and optional public replies.' },
              { icon: faCommentDots, title: 'Seen + Typing Reaction', description: 'Stage seen and typing behavior in supported automation editors so future reply flows feel more natural.' },
              { icon: faLink, title: 'Webhook Lead Delivery', description: 'Send collected email leads to your own webhook so your CRM, database, sheet, or email systems can process each lead instantly.' },
              { icon: faCogs, title: 'Custom Webhook', description: 'Use one verified webhook destination for each email-capture automation and keep delivery reliable.' },
              { icon: faChartLine, title: 'Suggest More', description: 'Send a dedicated Suggest More template after supported replies to offer additional options, products, or next steps.' },
              { icon: faComments, title: 'Comment Moderation', description: 'Manage separate hide and delete keyword lists for comments, with moderation words kept exclusive from automations and global triggers.' },
              { icon: faUserFriends, title: 'Followers Only', description: 'Gate supported automations until the user follows your account, with a custom message for non-followers.' },
            ].map((feature, index) => (
              <RevealSection key={index} delay={index * 40}>
                <div className="h-full text-center p-6 sm:p-8 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] hover:shadow-lg dark:hover:shadow-purple-500/[0.04] transition-all duration-300 hover:-translate-y-1 hover:border-gray-200 dark:hover:border-white/[0.1]">
                  <div className="mb-4 text-3xl sm:text-4xl text-gray-800 dark:text-gray-200">
                    <FontAwesomeIcon icon={feature.icon} />
                  </div>
                  <h5 className="font-bold text-lg sm:text-xl mb-2 text-gray-900 dark:text-white">
                    {feature.title}
                  </h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY CHOOSE ===== */}
      <section className="py-16 sm:py-24 bg-gray-50/60 dark:bg-white/[0.015]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <RevealSection>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-12 sm:mb-16 text-gray-900 dark:text-white">
              Why Choose DM Panda?
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { icon: faBolt, title: 'Smart Automation', description: 'Set up automated message sequences based on triggers and user interactions.' },
              { icon: faUsersCog, title: 'Audience Segmentation', description: 'Target specific user groups with personalized messages for better engagement.' },
              { icon: faChartLine, title: 'Performance Analytics', description: 'Track your campaign performance with detailed analytics and reports.' },
            ].map((feature, index) => (
              <RevealSection key={index} delay={index * 100}>
                <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] hover:shadow-lg dark:hover:shadow-purple-500/[0.04] transition-all duration-300 hover:-translate-y-1">
                  <div className="mb-5 text-3xl sm:text-4xl text-gray-800 dark:text-gray-200">
                    <FontAwesomeIcon icon={feature.icon} />
                  </div>
                  <h4 className="text-xl sm:text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                    {feature.title}
                  </h4>
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-16 sm:py-24 bg-white dark:bg-neutral-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <RevealSection>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-12 sm:mb-16 text-gray-900 dark:text-white">
              Get Started in 3 Simple Steps
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { icon: faPlug, title: 'Connect Account', description: 'Securely link your Instagram account to DM Panda.' },
              { icon: faSlidersH, title: 'Set Up Campaigns', description: 'Define your target audience and create your message sequences.' },
              { icon: faRocket, title: 'Launch & Monitor', description: 'Start your automation and track results through the dashboard.' },
            ].map((step, index) => (
              <RevealSection key={index} delay={index * 100}>
                <div className="p-6 sm:p-8 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#833AB4] to-[#405DE6] rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-5">
                    {index + 1}
                  </div>
                  <h4 className="text-xl sm:text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                    {step.title}
                  </h4>
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== VISUALIZE WORKFLOW ===== */}
      <section className="py-16 sm:py-24 bg-gray-50/60 dark:bg-white/[0.015]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <RevealSection className="order-2 lg:order-1">
              <img
                src="/images/mobile_screen.png"
                alt="Responsive Mobile Screen"
                className="w-full max-w-sm mx-auto lg:mx-0 animate-float"
                style={{ maxHeight: '500px' }}
              />
            </RevealSection>
            <RevealSection delay={100} className="order-1 lg:order-2 text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4 text-gray-900 dark:text-white">
                Visualize Your Auto Workflow
              </h2>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                See how DM Panda automates your Instagram interactions seamlessly.
              </p>
              <AuthRedirectButton className="inline-block bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-bold py-3 px-8 rounded-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] text-sm sm:text-base">
                Get Started
              </AuthRedirectButton>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ===== EXPLORE POWER ===== */}
      <section className="py-16 sm:py-24 bg-white dark:bg-neutral-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <RevealSection>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-10 sm:mb-12 text-gray-900 dark:text-white">
              Explore the Power of DMPanda
            </h2>
          </RevealSection>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <RevealSection className="text-center lg:text-left">
              <h3 className="text-xl sm:text-2xl font-bold leading-tight mb-4 text-gray-900 dark:text-white">
                Full-Suite Instagram Automation
              </h3>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                From auto-replying to comments and story mentions to running giveaways and capturing leads, DMPanda provides a complete toolkit to put your Instagram engagement on autopilot. Discover how our features can save you time and grow your brand.
              </p>
              <Link to="/features" className="inline-block bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-bold py-3 px-8 rounded-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] text-sm sm:text-base">
                See All Features
              </Link>
            </RevealSection>
            <RevealSection delay={100}>
              <img
                src="/images/workflow.png"
                alt="Automation Workflow"
                className="w-full h-auto rounded-2xl shadow-lg max-w-lg mx-auto"
              />
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-16 sm:py-20 bg-gray-900 dark:bg-white/[0.04] border-t border-gray-800 dark:border-white/[0.06]">
        <RevealSection>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 text-white dark:text-white">
              Ready to Boost Your Instagram Engagement?
            </h2>
            <p className="text-base sm:text-lg mb-7 text-gray-300 dark:text-gray-400 max-w-2xl mx-auto">
              Join DM Panda today and start automating your DMs like a pro.
            </p>
            <AuthRedirectButton className="inline-block bg-white dark:bg-gradient-to-r dark:from-[#405DE6] dark:via-[#833AB4] dark:to-[#FD1D1D] text-gray-900 dark:text-white font-bold py-3.5 px-8 sm:py-4 sm:px-10 rounded-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg text-sm sm:text-base">
              Sign Up Now
            </AuthRedirectButton>
          </div>
        </RevealSection>
      </section>
    </div>
  );
};

export default HomePage;
