import React from 'react';
import { Link } from 'react-router-dom';
import { BlogSection } from '../data';
import { Lightbulb, ChevronRight } from 'lucide-react';

interface BlogContentProps {
  sections: BlogSection[];
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export const BlogContent: React.FC<BlogContentProps> = ({ sections }) => {
  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      {sections.map((section) => {
        const sectionId = section.heading ? slugifyHeading(section.heading) : section.id;
        const HeadingTag = section.heading
          ? (`h${section.headingLevel || 2}` as keyof JSX.IntrinsicElements)
          : null;

        return (
          <section key={section.id} id={sectionId} className="mb-10 sm:mb-12 scroll-mt-24">
            {HeadingTag && section.heading && (
              <HeadingTag className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                {section.heading}
              </HeadingTag>
            )}

            {section.paragraphs && section.paragraphs.map((paragraph, idx) => (
              <p
                key={idx}
                className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-4"
              >
                {renderTextWithLinks(paragraph)}
              </p>
            ))}

            {section.listItems && section.listItems.length > 0 && (
              section.listStyle === 'ol' ? (
                <ol className="list-decimal list-inside space-y-2 mb-4 text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  {section.listItems.map((item, idx) => (
                    <li key={idx} className="pl-1">
                      {renderTextWithLinks(item)}
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="space-y-3 mb-4">
                  {section.listItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                      <ChevronRight className="w-5 h-5 text-[#833AB4] dark:text-purple-300 shrink-0 mt-0.5" />
                      <span>{renderTextWithLinks(item)}</span>
                    </li>
                  ))}
                </ul>
              )
            )}

            {section.image && (
              <figure className="my-8 sm:my-10">
                <img
                  src={section.image}
                  alt={section.imageAlt || ''}
                  loading="lazy"
                  decoding="async"
                  className="w-full rounded-2xl border border-gray-100 dark:border-white/[0.06]"
                />
                {section.imageAlt && (
                  <figcaption className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
                    {section.imageAlt}
                  </figcaption>
                )}
              </figure>
            )}

            {section.callout && (
              <div className="my-8 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#405DE6]/5 via-[#833AB4]/5 to-[#FCAF45]/5 border border-[#833AB4]/10 dark:border-[#833AB4]/20">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-[#833AB4] dark:text-purple-300" />
                  <span className="text-sm font-bold uppercase tracking-wider text-[#833AB4] dark:text-purple-300">
                    {section.callout.title}
                  </span>
                </div>
                <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                  {section.callout.text}
                </p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

function renderTextWithLinks(text: string): React.ReactNode {
  // Convert internal path references like /features or /login into client-side links
  const internalLinkRegex = /(\/features|\/pricing|\/login|\/blog\/[a-z0-9-]+)(?![\w/-])/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // We need to reset regex by creating a new one each iteration or using a manual approach
  const regex = new RegExp(internalLinkRegex.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) parts.push(<span key={key++}>{before}</span>);
    const path = match[0];
    parts.push(
      <Link key={key++} to={path} className="font-semibold text-[#833AB4] dark:text-purple-300 hover:underline">
        {path}
      </Link>
    );
    lastIndex = regex.lastIndex;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) parts.push(<span key={key++}>{remaining}</span>);

  return parts.length > 1 ? parts : text;
}

export default BlogContent;
