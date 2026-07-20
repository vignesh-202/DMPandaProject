import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  decoding?: 'async' | 'sync' | 'auto';
  /** If true, try loading a .webp version first with .png fallback */
  preferWebp?: boolean;
  /** Width for responsive srcset (optional) */
  width?: number;
  height?: number;
}

/**
 * OptimizedImage — Performance-conscious image component.
 *
 * Features:
 * - Uses <picture> with WebP source when preferWebp is true
 * - IntersectionObserver-based native lazy loading
 * - Smooth fade-in transition on load
 * - Prevents layout shift via aspect-ratio when dimensions provided
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  fetchPriority = 'auto',
  decoding = 'async',
  preferWebp = false,
  width,
  height,
}) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check if already loaded (cached images fire onLoad synchronously)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const handleLoad = () => setLoaded(true);

  const webpSrc = preferWebp && src.endsWith('.png')
    ? src.replace(/\.png$/, '.webp')
    : null;

  const style: React.CSSProperties = {
    ...(width && height ? { aspectRatio: `${width} / ${height}` } : {}),
  };

  const imgClassName = `${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`;

  if (webpSrc) {
    return (
      <picture>
        <source srcSet={webpSrc} type="image/webp" />
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding={decoding}
          className={imgClassName}
          style={style}
          onLoad={handleLoad}
          width={width}
          height={height}
        />
      </picture>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      className={imgClassName}
      style={style}
      onLoad={handleLoad}
      width={width}
      height={height}
    />
  );
};

export default React.memo(OptimizedImage);
