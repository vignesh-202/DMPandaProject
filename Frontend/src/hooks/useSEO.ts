import { useEffect } from 'react';

// Production canonical origin must strictly be https://dmpanda.com
export const CANONICAL_ORIGIN = 'https://dmpanda.com';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  schema?: Record<string, any> | Record<string, any>[];
  noIndex?: boolean;
  googleSiteVerification?: string;
}

function resolveAbsoluteUrl(url?: string): string {
  if (!url) return `${CANONICAL_ORIGIN}/images/logo.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${CANONICAL_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function formatCanonical(canonical?: string): string {
  if (canonical) {
    let clean = canonical.trim();
    // Normalize any http/https or www prefix to exactly https://dmpanda.com
    clean = clean.replace(/^https?:\/\/(?:www\.)?dmpanda\.com/i, CANONICAL_ORIGIN);
    if (!clean.startsWith('http')) {
      clean = `${CANONICAL_ORIGIN}${clean.startsWith('/') ? '' : '/'}${clean}`;
    }
    // Remove query params or hashes if present
    clean = clean.split('?')[0].split('#')[0];
    if (clean === CANONICAL_ORIGIN) {
      return `${CANONICAL_ORIGIN}/`;
    }
    return clean.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname || '/';
    if (!pathname || pathname === '/') {
      return `${CANONICAL_ORIGIN}/`;
    }
    const cleanPath = pathname.replace(/\/+$/, '');
    return `${CANONICAL_ORIGIN}${cleanPath}`;
  }

  return `${CANONICAL_ORIGIN}/`;
}

export function useSEO({
  title,
  description,
  keywords,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  schema,
  noIndex = false,
  googleSiteVerification,
}: SEOProps) {
  useEffect(() => {
    // 1. Document Title
    document.title = title;

    // 2. Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // 3. Meta Keywords
    if (keywords) {
      let metaKey = document.querySelector('meta[name="keywords"]');
      if (!metaKey) {
        metaKey = document.createElement('meta');
        metaKey.setAttribute('name', 'keywords');
        document.head.appendChild(metaKey);
      }
      metaKey.setAttribute('content', keywords);
    } else {
      const metaKey = document.querySelector('meta[name="keywords"]');
      if (metaKey) {
        metaKey.remove();
      }
    }

    // 4. Meta Robots & Search Engine Crawler Directives (Synchronized)
    const robotsContent = noIndex
      ? 'noindex,nofollow'
      : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

    ['robots', 'googlebot', 'bingbot'].forEach((name) => {
      let crawlerMeta = document.querySelector(`meta[name="${name}"]`);
      if (!crawlerMeta) {
        crawlerMeta = document.createElement('meta');
        crawlerMeta.setAttribute('name', name);
        document.head.appendChild(crawlerMeta);
      }
      crawlerMeta.setAttribute('content', robotsContent);
    });

    // 5. Canonical Link URL (Strips query params, enforces https://dmpanda.com)
    const finalCanonical = formatCanonical(canonical);
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', finalCanonical);

    // 6. Google Search Console Verification Meta Tag (if configured)
    const verificationCode = googleSiteVerification || import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;
    if (verificationCode && verificationCode.trim() !== '' && !verificationCode.includes('%VITE_')) {
      let gMeta = document.querySelector('meta[name="google-site-verification"]');
      if (!gMeta) {
        gMeta = document.createElement('meta');
        gMeta.setAttribute('name', 'google-site-verification');
        document.head.appendChild(gMeta);
      }
      gMeta.setAttribute('content', verificationCode.trim());
    }

    // 7. Open Graph (OG) Tags (Absolute image paths required by Google & Social crawlers)
    const absoluteImage = resolveAbsoluteUrl(ogImage);
    const ogTags = {
      'og:title': ogTitle || title,
      'og:description': ogDescription || description,
      'og:image': absoluteImage,
      'og:url': finalCanonical,
      'og:type': ogType,
    };

    Object.entries(ogTags).forEach(([property, content]) => {
      let ogMeta = document.querySelector(`meta[property="${property}"]`);
      if (!ogMeta) {
        ogMeta = document.createElement('meta');
        ogMeta.setAttribute('property', property);
        document.head.appendChild(ogMeta);
      }
      ogMeta.setAttribute('content', content);
    });

    // 8. Twitter Card Tags
    const twitterTags = {
      'twitter:card': twitterCard,
      'twitter:title': ogTitle || title,
      'twitter:description': ogDescription || description,
      'twitter:image': absoluteImage,
    };

    Object.entries(twitterTags).forEach(([name, content]) => {
      let twMeta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      if (!twMeta) {
        twMeta = document.createElement('meta');
        twMeta.setAttribute('name', name);
        document.head.appendChild(twMeta);
      }
      twMeta.setAttribute('content', content);
    });

    // 9. JSON-LD Structured Data Schema
    let schemaScript = document.querySelector('#jsonld-schema');
    if (schema) {
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.setAttribute('id', 'jsonld-schema');
        schemaScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(schemaScript);
      }
      schemaScript.innerHTML = JSON.stringify(schema);
    } else if (schemaScript) {
      schemaScript.remove();
    }

    return () => {
      // Clean up dynamic schema script tag on unmount to prevent page bleeding
      const script = document.querySelector('#jsonld-schema');
      if (script) {
        script.remove();
      }
    };
  }, [
    title,
    description,
    keywords,
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    twitterCard,
    schema,
    noIndex,
    googleSiteVerification,
  ]);
}
