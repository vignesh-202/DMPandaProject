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
    month: 'long',
    day: 'numeric',
  });
}

export const BlogCard: React.FC<BlogCardProps> = ({ post, featured = false }) => {
  if (featured) {
    return (
      <article className="group relative grid lg:grid-cols-2 gap-6 lg:gap-10 items-center bg-gray-50 dark:bg-white/[0.03] rounded-3xl p-5 sm:p-6 lg:p-8 border border-gray-100 dark:border-white/[0.06] hover:border-gray-200 dark:hover:border-white/[0.1] transition-all duration-300">
        <div className="relative aspect-[16/9] lg:aspect-[16/9] rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
          <img
            src={post.image}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#405DE6]/10 via-[#833AB4]/10 to-[#FCAF45]/10 text-[#833AB4] dark:text-purple-300">
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
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight group-hover:text-[#833AB4] dark:group-hover:text-purple-300 transition-colors">
            {post.title}
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {post.excerpt}
          </p>
          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-gray-900 dark:text-white hover:text-[#833AB4] dark:hover:text-purple-300 transition-colors"
          >
            Read article
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col h-full bg-gray-50 dark:bg-white/[0.03] rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-white/[0.06] hover:border-gray-200 dark:hover:border-white/[0.1] hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
        <img
          src={post.image}
          alt={post.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      </div>
      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#405DE6]/8 via-[#833AB4]/8 to-[#FCAF45]/8 text-[#833AB4] dark:text-purple-300">
            {post.category}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.readTime}
          </span>
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 leading-snug group-hover:text-[#833AB4] dark:group-hover:text-purple-300 transition-colors">
          {post.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed flex-1 line-clamp-3">
          {post.excerpt}
        </p>
        <Link
          to={`/blog/${post.slug}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white hover:text-[#833AB4] dark:hover:text-purple-300 transition-colors"
        >
          Read article
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
};

export default BlogCard;
