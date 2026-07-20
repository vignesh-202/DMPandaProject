import React from 'react';
import { Link } from 'react-router-dom';
import { BlogPost } from '../data';
import { ArrowRight } from 'lucide-react';

interface RelatedPostsProps {
  posts: BlogPost[];
  title?: string;
}

export const RelatedPosts: React.FC<RelatedPostsProps> = ({
  posts,
  title = 'Related articles',
}) => {
  if (!posts.length) return null;

  return (
    <aside className="mt-16 sm:mt-20 pt-10 border-t border-gray-100 dark:border-white/[0.06]">
      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group p-5 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] hover:border-gray-200 dark:hover:border-white/[0.1] transition-all duration-300 hover:-translate-y-0.5"
          >
            <span className="text-xs font-semibold text-[#833AB4] dark:text-purple-300 uppercase tracking-wider">
              {post.category}
            </span>
            <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-2 mb-2 leading-snug group-hover:text-[#833AB4] dark:group-hover:text-purple-300 transition-colors">
              {post.title}
            </h4>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              Read article
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
};

export default RelatedPosts;
