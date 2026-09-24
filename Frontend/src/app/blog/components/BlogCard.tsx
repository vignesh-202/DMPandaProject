import React from 'react';
import { Link } from 'react-router-dom';
import { BlogPost } from '../data';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const BlogCard: React.FC<BlogCardProps> = ({ post, featured = false }) => {
  if (featured) {
    return (
      <article className="group relative grid lg:grid-cols-12 gap-6 lg:gap-8 items-center bg-gray-50 dark:bg-[#121214] rounded-3xl p-5 sm:p-6 lg:p-8 border border-gray-200/80 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] transition-all duration-300 shadow-sm hover:shadow-xl dark:shadow-none">
        <div className="lg:col-span-7 relative aspect-[16/9] rounded-2xl overflow-hidden bg-neutral-900 border border-white/[0.08] shadow-inner">
          <picture className="w-full h-full block">
            {post.image && post.image.endsWith('.png') && (
              <source srcSet={post.image.replace(/\.png$/, '.webp')} type="image/webp" />
            )}
            <img
              src={post.image}
              alt={post.title}
              loading="eager"
              decoding="async"
              width={1200}
              height={675}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </picture>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2.5 mb-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20">
              {post.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {post.readTime}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight tracking-tight group-hover:text-[#833AB4] dark:group-hover:text-purple-300 transition-colors">
            <Link to={`/blog/${post.slug}`}>{post.title}</Link>
          </h2>

          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 leading-relaxed line-clamp-3">
            {post.excerpt}
          </p>

          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white hover:text-[#833AB4] dark:hover:text-purple-300 transition-colors group/link"
          >
            Read Complete Playbook
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/link:translate-x-1" />
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col h-full bg-gray-50 dark:bg-[#121214] rounded-2xl sm:rounded-3xl border border-gray-200/80 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] hover:-translate-y-1 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-lg dark:shadow-none">
      {/* 16:9 Editorial Cover Container */}
      <div className="relative aspect-[16/9] overflow-hidden bg-neutral-900 border-b border-gray-200/60 dark:border-white/[0.06]">
        <picture className="w-full h-full block">
          {post.image && post.image.endsWith('.png') && (
            <source srcSet={post.image.replace(/\.png$/, '.webp')} type="image/webp" />
          )}
          <img
            src={post.image}
            alt={post.title}
            loading="lazy"
            decoding="async"
            width={600}
            height={338}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </picture>
      </div>

      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5 mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20">
            {post.category}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.readTime}
          </span>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 leading-snug group-hover:text-[#833AB4] dark:group-hover:text-purple-300 transition-colors">
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed flex-1 line-clamp-3">
          {post.excerpt}
        </p>

        <div className="pt-4 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatDate(post.publishedAt)}</span>
          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:text-[#833AB4] dark:hover:text-purple-300 transition-colors group/link"
          >
            Read Article
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/link:translate-x-1" />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default BlogCard;
