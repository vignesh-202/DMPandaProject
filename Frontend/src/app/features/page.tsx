"use client";
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import {
  Sparkles,
  Zap,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Layers,
  Search,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface FeatureItem {
  id: string;
  name: string;
  category: 'all' | 'automations' | 'templates' | 'growth' | 'safety';
  categoryLabel: string;
  badge?: string;
  description: string;
  benefit: string;
  image: string;
  featured?: boolean;
  stat?: string;
}

const allFeatures: FeatureItem[] = [
  // --- AUTOMATIONS ---
  {
    id: 'reel-comment',
    name: 'Reel Comment Automation',
    category: 'automations',
    categoryLabel: 'Viral Content',
    badge: 'Most Popular',
    stat: '10x Engagement Rate',
    featured: true,
    description: 'Instantly send a targeted, personalized DM to every viewer who comments on your viral Instagram Reels.',
    benefit: 'Turns viral Reels into high-converting sales funnels without manual community management.',
    image: '/images/reel_comment_dm_reply.png',
  },
  {
    id: 'post-comment',
    name: 'Post Comment Automation',
    category: 'automations',
    categoryLabel: 'Feed Automation',
    description: 'Automatically trigger private DMs and public replies the moment someone comments on your Instagram feed posts.',
    benefit: 'Captures hot buyer intent in under 0.4 seconds while commenters are still active on your post.',
    image: '/images/post_comment_dm_reply.png',
  },
  {
    id: 'live-automation',
    name: 'Instagram Live Automation',
    category: 'automations',
    categoryLabel: 'Live Streaming',
    badge: 'High Conversion',
    stat: 'Zero Viewer Dropoff',
    featured: true,
    description: 'Deliver instant checkout links, discount codes, and resources when live viewers type your trigger keyword in the stream chat.',
    benefit: 'Monetize broadcasts effortlessly without typing links in the live comments or losing viewer attention.',
    image: '/images/live_automation.png',
  },
  {
    id: 'story-mention',
    name: 'Story Mention Automation',
    category: 'automations',
    categoryLabel: 'UGC & Loyalty',
    description: 'Automatically thank followers with customized VIP discounts whenever they @mention your account in their Stories.',
    benefit: 'Incentivizes viral user-generated content and rewards genuine brand advocates automatically.',
    image: '/images/story_mention_dm_reply.png',
  },
  {
    id: 'story-reply',
    name: 'Story Reply Automation',
    category: 'automations',
    categoryLabel: 'Stories',
    description: 'Deliver instant direct message responses whenever users react or reply directly to your active 24-hour Stories.',
    benefit: 'Converts ephemeral Story interactions into permanent, automated customer relationships.',
    image: '/images/story_reply_dm_reply.png',
  },
  {
    id: 'ad-comment',
    name: 'Sponsored Ad Comment Automation',
    category: 'automations',
    categoryLabel: 'Paid Media',
    description: 'Send private, personalized direct messages to high-intent users who comment on your Meta sponsored ads.',
    benefit: 'Maximizes ROAS by converting expensive paid ad commenters into one-on-one sales discussions.',
    image: '/images/sponsored_ad_comment_reply.png',
  },

  // --- TEMPLATES ---
  {
    id: 'welcome-message',
    name: 'Welcome Message',
    category: 'templates',
    categoryLabel: 'Onboarding',
    badge: 'Essential',
    stat: '85% First-Touch Open Rate',
    featured: true,
    description: 'Greet new followers and first-time messengers with a tailored welcome card, orientation links, and starter discounts.',
    benefit: 'Establishes a premium first impression and guides new leads to your highest-value offers instantly.',
    image: '/images/welcome_message.png',
  },
  {
    id: 'carousel-template',
    name: 'Carousel Template',
    category: 'templates',
    categoryLabel: 'Visual Commerce',
    badge: 'Multi-Card',
    stat: '3x Click-Throughs',
    featured: true,
    description: 'Showcase up to 10 swipeable cards in the DM with product imagery, titles, pricing, and direct checkout buttons.',
    benefit: 'Creates an interactive shopping experience inside Instagram chat with direct links to purchase.',
    image: '/images/carousel_template.png',
  },
  {
    id: 'button-template',
    name: 'Button Template',
    category: 'templates',
    categoryLabel: 'Navigation',
    description: 'Pair clear text messages with up to three actionable CTA buttons leading to URLs or automated sub-flows.',
    benefit: 'Streamlines customer journeys with frictionless decision paths that eliminate typing friction.',
    image: '/images/button_template.png',
  },
  {
    id: 'quick-replies',
    name: 'Quick Replies Template',
    category: 'templates',
    categoryLabel: 'Interactive Chips',
    description: 'Provide horizontal scrollable tap chips for quick answers, product preferences, and guided diagnostics.',
    benefit: 'Reduces user effort to a single tap, dramatically boosting survey and quiz completion rates.',
    image: '/images/quick_replies_template.png',
  },
  {
    id: 'share-template',
    name: 'Share Template',
    category: 'templates',
    categoryLabel: 'Feed Amplification',
    description: 'Directly embed your native Instagram posts or Reels into the DM conversation with full thumbnail previews.',
    benefit: 'Revives catalog content and directs engaged chat users back to your top feed assets.',
    image: '/images/share_template.png',
  },
  {
    id: 'media-template',
    name: 'Media Template',
    category: 'templates',
    categoryLabel: 'Rich Media',
    description: 'Deliver high-resolution images, lookbooks, and video attachments directly in direct messages.',
    benefit: 'Captures visual attention immediately and delivers lead magnets or lookbooks in native formats.',
    image: '/images/media_template.png',
  },
  {
    id: 'text-template',
    name: 'Text Template',
    category: 'templates',
    categoryLabel: 'Direct Message',
    description: 'Lightning-fast, personalized plain text responses engineered for natural 1-on-1 human conversations.',
    benefit: 'Perfect for concise answers, personal confirmations, or warm conversational touchpoints.',
    image: '/images/text_template.png',
  },

  // --- GROWTH ---
  {
    id: 'follow-gated',
    name: 'Follow-Gated DMs',
    category: 'growth',
    categoryLabel: 'Follower Growth',
    badge: 'Viral Engine',
    stat: 'Verified Follow Check',
    featured: true,
    description: 'Require users to follow your Instagram account before your automation releases exclusive links or promo codes.',
    benefit: 'Directly converts comment traffic and giveaway participants into permanent, loyal followers.',
    image: '/images/follow_gated_dm.png',
  },
  {
    id: 'super-profile',
    name: 'Super Profile (Link in Bio)',
    category: 'growth',
    categoryLabel: 'Traffic Hub',
    badge: 'High Conversion',
    stat: '14k Clicks/Month Average',
    featured: true,
    description: 'Build a blazing-fast, mobile-optimized link-in-bio page directly inside DM Panda with built-in analytics.',
    benefit: 'Replaces generic link-in-bio tools with a branded, trackable conversion engine for all Instagram traffic.',
    image: '/images/super_profile.png',
  },
  {
    id: 'post-share',
    name: 'Post Share Automation',
    category: 'growth',
    categoryLabel: 'Virality',
    description: 'Automatically recognize when a user shares your post into DMs and trigger an instant reward or entry ticket.',
    benefit: 'Incentivizes peer-to-peer sharing and viral word-of-mouth distribution.',
    image: '/images/post_share_automation.png',
  },
  {
    id: 'reel-share',
    name: 'Reel Share Automation',
    category: 'growth',
    categoryLabel: 'Virality',
    description: 'Send an immediate automated thank you and resource link whenever a viewer forwards your Reel via DM.',
    benefit: 'Turns passive content shares into active one-on-one business conversations.',
    image: '/images/reel_share_automation.png',
  },
  {
    id: 'suggest-more',
    name: 'Suggest More (Upsells)',
    category: 'growth',
    categoryLabel: 'E-commerce',
    description: 'Intelligently propose relevant alternative items or complementary accessories with one-tap bundle savings.',
    benefit: 'Increases average order value and customer satisfaction with contextual product discovery.',
    image: '/images/suggest_more.png',
  },

  // --- SAFETY & CONTROL ---
  {
    id: 'comment-moderation',
    name: 'Abusive Comment Moderation',
    category: 'safety',
    categoryLabel: 'Brand Protection',
    badge: 'Automated Shield',
    stat: '0.18s Response Speed',
    featured: true,
    description: 'Automatically filter, hide, or delete spam, offensive words, and malicious phishing links in real time.',
    benefit: 'Maintains a clean brand reputation and safeguards your community 24/7 without manual moderation.',
    image: '/images/comment_moderation.png',
  },
  {
    id: 'global-triggers',
    name: 'Global Keyword Triggers',
    category: 'safety',
    categoryLabel: 'Master Engine',
    description: 'Set account-wide keywords that activate auto-replies across all posts, Reels, Stories, and inbound DMs.',
    benefit: 'Run synchronized omni-channel campaigns using a single memorable call to action.',
    image: '/images/global_triggers.png',
  },
  {
    id: 'inbox-menu',
    name: 'Inbox Menu',
    category: 'safety',
    categoryLabel: 'Customer Support',
    description: 'A permanent, structured navigation menu inside direct messages that helps customers self-serve 24/7.',
    benefit: 'Resolves common support queries instantly, reducing manual workload by over 70%.',
    image: '/images/inbox_menu.png',
  },
  {
    id: 'convo-starters',
    name: 'Conversation Starters',
    category: 'safety',
    categoryLabel: 'Inbound Inquiries',
    description: 'Prompt first-time visitors with clickable FAQ buttons before they type their first question.',
    benefit: 'Directs prospects down structured conversion pathways the moment they open your chat window.',
    image: '/images/conversation_starter.png',
  },
  {
    id: 'public-comment-replies',
    name: 'Public Comment Auto-Replies',
    category: 'safety',
    categoryLabel: 'Social Proof',
    description: 'Post a public reply confirming that a DM was delivered, demonstrating responsiveness to the algorithm.',
    benefit: 'Doubles comment thread volume, triggering Instagram explore recommendations and community trust.',
    image: '/images/comment_auto_reply.png',
  },
];

const categoryTabs = [
  { id: 'all', label: 'All Features', count: allFeatures.length, icon: Layers },
  { id: 'automations', label: 'Automations', count: 6, icon: Zap },
  { id: 'templates', label: 'Interactive Templates', count: 7, icon: MessageSquare },
  { id: 'growth', label: 'Growth Engines', count: 5, icon: TrendingUp },
  { id: 'safety', label: 'Safety & Control', count: 5, icon: ShieldCheck },
];

export const FeaturesPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useSEO({
    title: 'Features | DM Panda - Smart Instagram Automation Suite',
    description: 'Explore all 23 powerful features: automated comment DMs, viral Reel auto-replies, interactive carousels, follow gates, and AI spam protection.',
    keywords: 'instagram automation features, comment reply bot, story mention auto reply, follow gate instagram dms, link in bio creator, carousel templates',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Instagram Automation Features | DM Panda',
        description: 'Explore DM Panda\'s full suite of 23 Instagram automation features.',
        url: 'https://dmpanda.com/features',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://dmpanda.com/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Features',
            item: 'https://dmpanda.com/features',
          },
        ],
      },
    ],
  });

  const filteredFeatures = useMemo(() => {
    return allFeatures.filter((f) => {
      const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-12 md:pb-16 border-b border-gray-100 dark:border-white/[0.06] overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-b from-[#833AB4]/10 via-[#4F46E5]/10 to-transparent blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#405DE6]/10 via-[#833AB4]/10 to-[#FCAF45]/10 border border-purple-500/20 text-[#833AB4] dark:text-purple-300 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-4 sm:mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Instagram Automation Suite
            </div>

            {/* Headline - Max 2 lines per taste-skill */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.15] sm:leading-[1.1] mb-4 sm:mb-6">
              Everything you need to turn <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] bg-clip-text text-transparent">
                Instagram into revenue.
              </span>
            </h1>

            {/* Subtext - Under 20 words per taste-skill */}
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-6 sm:mb-8 max-w-xl mx-auto px-2">
              Automate DMs, comments, Stories, and Reels without losing personal connection or violating Meta guidelines.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto sm:max-w-none">
              <Link
                to="/login"
                className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 min-h-[44px] rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm sm:text-base hover:opacity-95 active:scale-[0.98] transition-all duration-200 shadow-md flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#catalog"
                className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 min-h-[44px] rounded-xl bg-gray-100 dark:bg-white/[0.05] border border-gray-200/80 dark:border-white/[0.08] text-gray-700 dark:text-gray-200 font-semibold text-sm sm:text-base hover:bg-gray-200/60 dark:hover:bg-white/[0.08] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
              >
                Browse All 23 Features
              </a>
            </div>

            {/* Trust Micro-Metrics Wall */}
            <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-100 dark:border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-center">
              <div>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">0.38s</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Average Response</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">100%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Meta Approved API</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">23 Tools</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Included in Pro</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">24/7</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Zero-Latency Uptime</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog & Filter Navigation Bar */}
      <section id="catalog" className="py-4 sm:py-6 border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-30 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
            {/* Category Tabs - Touch scroll on mobile with edge-to-edge bleed */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth touch-pan-x">
              {categoryTabs.map((tab) => {
                const IconComponent = tab.icon;
                const isSelected = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0 active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                        : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-white/20 dark:bg-black/10 text-white dark:text-gray-900'
                          : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search */}
            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 23 features..."
                className="w-full pl-10 pr-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#833AB4]/30 focus:border-[#833AB4] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1 py-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Content Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {filteredFeatures.length === 0 ? (
            <div className="text-center py-16 sm:py-24 bg-gray-50 dark:bg-white/[0.02] rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-white/[0.06] p-6">
              <SlidersHorizontal className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1">No features found</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">
                Try searching for something else like "Reel", "Template", or "Story".
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
              {filteredFeatures.map((feature) => {
                const isFeatured = feature.featured && (selectedCategory === 'all' || filteredFeatures.length <= 8);

                return (
                  <div
                    key={feature.id}
                    className={`group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-50 dark:bg-[#121214] border border-gray-200/80 dark:border-white/[0.07] hover:border-gray-300 dark:hover:border-white/[0.15] transition-all duration-300 shadow-sm hover:shadow-xl dark:shadow-none ${
                      isFeatured
                        ? 'col-span-1 md:col-span-2 lg:col-span-12 xl:col-span-8 p-4 sm:p-6 md:p-8 lg:p-10'
                        : 'col-span-1 md:col-span-1 lg:col-span-6 xl:col-span-4 p-4 sm:p-5 lg:p-6'
                    }`}
                  >
                    {/* Top Content Row */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
                        <span className="inline-block px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide uppercase bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20">
                          {feature.categoryLabel}
                        </span>
                        {feature.badge && (
                          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/20">
                            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            {feature.badge}
                          </span>
                        )}
                      </div>

                      <h3
                        className={`font-bold tracking-tight text-gray-900 dark:text-white mb-2 sm:mb-3 group-hover:text-[#833AB4] dark:group-hover:text-purple-300 transition-colors ${
                          isFeatured ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg sm:text-xl md:text-2xl'
                        }`}
                      >
                        {feature.name}
                      </h3>

                      <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-4 sm:mb-6">
                        {feature.description}
                      </p>
                    </div>

                    {/* Image Mockup Presentation Frame */}
                    <div
                      className={`relative w-full overflow-hidden rounded-xl sm:rounded-2xl bg-neutral-900 border border-white/[0.08] p-2 sm:p-3 md:p-4 flex items-center justify-center shadow-inner my-1 sm:my-2 ${
                        isFeatured ? 'aspect-[16/10] sm:aspect-[16/9]' : 'aspect-[16/10]'
                      }`}
                    >
                      {/* Ambient background bloom */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#405DE6]/10 via-transparent to-[#833AB4]/10 opacity-70 group-hover:opacity-100 transition-opacity duration-500" />

                      <picture className="w-full h-full flex items-center justify-center relative z-10">
                        {feature.image.endsWith('.png') && (
                          <source srcSet={feature.image.replace(/\.png$/, '.webp')} type="image/webp" />
                        )}
                        <img
                          src={feature.image}
                          alt={feature.name}
                          loading="lazy"
                          decoding="async"
                          width={isFeatured ? 900 : 600}
                          height={isFeatured ? 600 : 400}
                          className="max-w-full max-h-full object-contain filter drop-shadow-2xl transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </picture>
                    </div>

                    {/* Bottom Value-Add / Benefit Banner */}
                    <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-gray-100 dark:border-white/[0.06] flex items-start gap-2 sm:gap-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-normal">
                        {feature.benefit}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 sm:py-24 border-t border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-[#0c0c0e]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            Ready to deploy all 23 automations?
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Connect your Instagram professional account in 60 seconds. No credit card required to start your 14-day free trial.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white font-bold text-base hover:opacity-95 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              Get Started for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-white font-semibold text-base hover:bg-gray-100 dark:hover:bg-white/[0.1] active:scale-[0.98] transition-all"
            >
              Compare Plans & Limits
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FeaturesPage;
