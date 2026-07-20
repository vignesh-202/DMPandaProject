import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import { getPostBySlug, getRelatedPosts, SITE_ORIGIN } from './data';
import { BlogContent } from './components/BlogContent';
import { RelatedPosts } from './components/RelatedPosts';
import { AuthorBio } from './components/AuthorBio';
import { Calendar, Clock, ArrowLeft, Share2, Tags } from 'lucide-react';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return <Navigate to="/not-found" replace />;
  }

  const relatedPosts = getRelatedPosts(post.slug, 3);
  const postUrl = `${SITE_ORIGIN}/blog/${post.slug}`;

  useSEO({
    title: post.metaTitle,
    description: post.metaDescription,
    keywords: post.keywords,
    canonical: post.canonical,
    ogTitle: post.title,
    ogDescription: post.excerpt,
    ogImage: post.image,
    ogType: 'article',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        'headline': post.title,
        'description': post.metaDescription,
        'image': post.image,
        'author': {
          '@type': 'Organization',
          'name': post.author,
          'url': SITE_ORIGIN,
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'DM Panda',
          'logo': {
            '@type': 'ImageObject',
            'url': `${SITE_ORIGIN}/images/logo.png`,
          },
        },
        'datePublished': post.publishedAt,
        'dateModified': post.updatedAt,
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': postUrl,
        },
        'url': postUrl,
        'keywords': post.keywords,
        'articleSection': post.category,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': SITE_ORIGIN,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Blog',
            'item': `${SITE_ORIGIN}/blog`,
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': post.title,
            'item': postUrl,
          },
        ],
      },
    ],
  });

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: postUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(postUrl);
        alert('Link copied to clipboard');
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-500">
      <article className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl pt-28 sm:pt-32 pb-16 sm:pb-24">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <li>
                <Link to="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li className="text-gray-300 dark:text-gray-600">/</li>
              <li>
                <Link to="/blog" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li className="text-gray-300 dark:text-gray-600">/</li>
              <li className="text-gray-900 dark:text-gray-200 font-medium truncate max-w-[200px] sm:max-w-md">
                {post.title}
              </li>
            </ol>
          </nav>

          {/* Back to blog */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to blog
          </Link>

          {/* Header */}
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#405DE6]/10 via-[#833AB4]/10 to-[#FCAF45]/10 text-[#833AB4] dark:text-purple-300">
                {post.category}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Updated {formatDate(post.updatedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {post.readTime}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight mb-5">
              {post.title}
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
              {post.excerpt}
            </p>
          </header>

          {/* Featured image */}
          <figure className="mb-10 sm:mb-12">
            <div className="rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] aspect-[16/9] shadow-lg">
              <img
                src={post.image}
                alt={post.title}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          </figure>

          {/* Author bio */}
          <div className="mb-10 sm:mb-12">
            <AuthorBio author={post.author} authorTitle={post.authorTitle} />
          </div>

          {/* Share */}
          <div className="flex items-center justify-between mb-8 sm:mb-10 pb-6 border-b border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Tags className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Tags:
              </span>
              <div className="flex flex-wrap gap-2">
                {post.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Share article"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>

          {/* Article body */}
          <BlogContent sections={post.content} />

          {/* Bottom CTA */}
          <div className="mt-14 sm:mt-16 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#405DE6]/5 via-[#833AB4]/5 to-[#FCAF45]/5 border border-[#833AB4]/10 dark:border-[#833AB4]/20">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {post.cta.title}
            </h3>
            <p className="text-base text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              {post.cta.text}
            </p>
            <Link
              to={post.cta.href}
              className="inline-block bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold px-8 py-3.5 rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
            >
              {post.cta.buttonText}
            </Link>
          </div>

          {/* Related posts */}
          <RelatedPosts posts={relatedPosts} />
        </article>
      </div>
  );
};

export default BlogPostPage;
