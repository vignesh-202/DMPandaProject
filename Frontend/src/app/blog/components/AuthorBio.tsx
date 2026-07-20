import React from 'react';
import { BadgeCheck } from 'lucide-react';

interface AuthorBioProps {
  author: string;
  authorTitle: string;
}

export const AuthorBio: React.FC<AuthorBioProps> = ({ author, authorTitle }) => {
  return (
    <div className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]">
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#405DE6] via-[#833AB4] to-[#FCAF45] flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0">
        DP
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            {author}
          </h3>
          <BadgeCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#833AB4] dark:text-purple-300" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {authorTitle}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The DM Panda team builds Instagram automation tools used by creators, agencies, and e-commerce brands to save time, engage followers, and grow revenue. We share practical, platform-compliant strategies based on real customer workflows.
        </p>
      </div>
    </div>
  );
};

export default AuthorBio;
