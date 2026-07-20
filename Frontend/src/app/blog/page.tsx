import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import { getAllPosts, getRecentPosts, SITE_ORIGIN } from './data';
import { BlogCard } from './components/BlogCard';
import { Newspaper, Search } from 'lucide-react';

const BlogIndexPage: React.FC = () => {
  const allPosts = getAllPosts();
  const recentPosts = getRecentPosts(allPosts.length);
  const featuredPost = recentPosts[0];
  const remainingPosts = recentPosts.slice(1);

  useSEO({
    title: 'Blog | DM Panda - Instagram Automation Tips & Guides',
    description: 'Learn how to automate Instagram comments, DMs, Reels, Stories, and Live with DM Panda. Practical guides, templates, and growth strategies for creators and brands.',
    keywords: 'instagram automation blog, instagram comment automation guide, dm automation tips, instagram marketing blog, instagram auto reply tutorial',
    canonical: `${SITE_ORIGIN}/blog`,
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      'name': 'DM Panda Blog',
      'description': 'Practical guides and tutorials for Instagram automation, comment replies, DM flows, and lead generation.',
      'url': `${SITE_ORIGIN}/blog`,
      'publisher': {
        '@type': 'Organization',
        'name': 'DM Panda',
        'logo': `${SITE_ORIGIN}/images/logo.png`,
      },
    },
  });

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-28 sm:pt-32 pb-16 sm:pb-24">
        {/* Header */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#405DE6]/10 via-[#833AB4]/10 to-[#FCAF45]/10 text-[#833AB4] dark:text-purple-300 text-xs font-bold uppercase tracking-widest mb-4">
            <Newspaper className="w-4 h-4" />
            DM Panda Blog
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight tracking-tight">
            Instagram Automation Tips That Drive Growth
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Practical guides, templates, and strategies to help you automate Instagram comments, DMs, Reels, Stories, and Live—without losing the human touch.
          </p>
        </div>

        {/* Featured post */}
        {featuredPost && (
          <div className="mb-12 sm:mb-16">
            <BlogCard post={featuredPost} featured />
          </div>
        )}

        {/* Search / filter hint */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Latest articles
          </h2>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              readOnly
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
              title="Search coming soon. Browse categories below."
            />
          </div>
        </div>

        {/* Post grid */}
        {remainingPosts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {remainingPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            More articles coming soon.
          </div>
        )}

        {/* CTA section */}
        <div className="mt-16 sm:mt-24 p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 dark:from-white/[0.04] dark:to-white/[0.02] text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white dark:text-white mb-3">
            Ready to Automate Your Instagram?
          </h2>
          <p className="text-gray-300 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of creators and brands using DM Panda to automate comments, DMs, and Stories. Start free, no credit card required.
          </p>
          <Link
            to="/login"
            className="inline-block bg-white dark:bg-gradient-to-r dark:from-[#405DE6] dark:via-[#833AB4] dark:to-[#FD1D1D] text-gray-900 dark:text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg"
          >
            Get Started for Free
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BlogIndexPage;
