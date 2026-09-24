import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import { getAllPosts, SITE_ORIGIN, BlogPost } from './data';
import { BlogCard } from './components/BlogCard';
import { Newspaper, Search, Sparkles, SlidersHorizontal, BookOpen, ArrowRight } from 'lucide-react';

const categories = [
  'All Articles',
  'Comment Automation',
  'DM Automation',
  'Story Automation',
  'Templates',
  'Lead Generation',
  'Safety & Moderation',
  'Growth & Giveaways',
];

const BlogIndexPage: React.FC = () => {
  const allPosts = getAllPosts();
  const [selectedCategory, setSelectedCategory] = useState<string>('All Articles');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useSEO({
    title: 'Blog & Playbooks | DM Panda - Instagram Automation Guides',
    description: 'Master Instagram comment automation, DM funnels, viral giveaway mechanics, and Story auto-replies with step-by-step verified playbooks.',
    keywords: 'instagram automation blog, instagram comment automation guide, dm automation tips, instagram marketing blog, instagram auto reply tutorial',
    canonical: `${SITE_ORIGIN}/blog`,
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'DM Panda Blog & Automation Playbooks',
      description: 'Practical guides and tutorials for Instagram automation, comment replies, DM flows, and lead generation.',
      url: `${SITE_ORIGIN}/blog`,
      publisher: {
        '@type': 'Organization',
        name: 'DM Panda',
        logo: `${SITE_ORIGIN}/images/logo.png`,
      },
    },
  });

  const filteredPosts = useMemo(() => {
    return allPosts.filter((post) => {
      const matchesCategory =
        selectedCategory === 'All Articles' ||
        post.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        post.tags.some((t) => t.toLowerCase().includes(selectedCategory.toLowerCase()));

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.tags.some((t) => t.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [allPosts, selectedCategory, searchQuery]);

  const featuredPost = filteredPosts.length > 0 && selectedCategory === 'All Articles' && !searchQuery ? filteredPosts[0] : null;
  const standardPosts = featuredPost ? filteredPosts.slice(1) : filteredPosts;

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      {/* Editorial Header Section */}
      <section className="relative pt-20 sm:pt-24 pb-12 sm:pb-16 border-b border-gray-100 dark:border-white/[0.06] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-gradient-to-b from-[#833AB4]/10 via-[#4F46E5]/10 to-transparent blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#405DE6]/10 via-[#833AB4]/10 to-[#FCAF45]/10 border border-purple-500/20 text-[#833AB4] dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-5">
              <Newspaper className="w-3.5 h-3.5" />
              DM Panda Editorial Playbooks
            </div>

            {/* Headline - Max 2 lines per taste-skill */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.1] mb-5">
              Instagram Automation <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] bg-clip-text text-transparent">
                Playbooks That Drive Revenue.
              </span>
            </h1>

            {/* Subtext - Under 20 words per taste-skill */}
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">
              Proven strategies, templates, and compliance guides to automate comments, DMs, Stories, and Reels without spamming.
            </p>
          </div>
        </div>
      </section>

      {/* Filter and Search Navigation Bar */}
      <section className="py-6 border-b border-gray-100 dark:border-white/[0.06] sticky top-0 z-30 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-none">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                        : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search playbooks & topics..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#833AB4]/30 focus:border-[#833AB4] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Articles Container */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Featured Article Hero Spotlight */}
          {featuredPost && (
            <div className="mb-12 sm:mb-16">
              <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                <Sparkles className="w-3.5 h-3.5" />
                Featured Editorial Playbook
              </div>
              <BlogCard post={featuredPost} featured />
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-[#833AB4] dark:text-purple-400" />
              {selectedCategory === 'All Articles' ? 'Latest Guides & Strategies' : `${selectedCategory} Articles`}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-gray-400">
                {filteredPosts.length}
              </span>
            </h2>
          </div>

          {/* Articles Bento Grid */}
          {standardPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {standardPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 dark:bg-white/[0.02] rounded-3xl border border-gray-100 dark:border-white/[0.06]">
              <SlidersHorizontal className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No articles match your criteria</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Try clearing your search or browsing across all categories.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('All Articles');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Bottom Editorial Callout */}
          <div className="mt-16 sm:mt-24 p-8 sm:p-12 rounded-3xl bg-gray-50 dark:bg-[#121214] border border-gray-200/80 dark:border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">
                Ready to put these automation playbooks into practice?
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Connect your Instagram account and launch your first automated comment DM or viral giveaway flow in under 5 minutes.
              </p>
            </div>
            <Link
              to="/login"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white font-bold text-sm sm:text-base hover:opacity-95 active:scale-[0.98] transition-all shadow-md shrink-0 flex items-center gap-2"
            >
              Get Started for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlogIndexPage;
