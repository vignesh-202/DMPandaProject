import React, { useState, useEffect } from 'react';

interface FlippingTextProps {
  texts: string[];
  duration?: number; // Duration for each text in milliseconds
  className?: string;
  highlightWords?: { [key: string]: string }; // e.g., { "Instagram": "text-instagram-red", "Facebook": "text-facebook" }
}

const FlippingText: React.FC<FlippingTextProps> = ({ texts, duration = 2000, className, highlightWords }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % texts.length);
        setIsFlipping(false);
      }, 500); // half of animation duration
    }, duration);

    return () => clearInterval(interval);
  }, [texts.length, duration]);

  const renderText = (text: string) => {
    if (!highlightWords) return text;

    let renderedText: React.ReactNode[] = [text];

    Object.entries(highlightWords).forEach(([word, colorClass]) => {
      renderedText = renderedText.flatMap((segment, i) => {
        if (typeof segment === 'string') {
          const parts = segment.split(new RegExp(`(${word})`, 'gi'));
          return parts.map((part, j) =>
            part.toLowerCase() === word.toLowerCase() ? (
              <span key={`${i}-${j}`} className={colorClass}>
                {part}
              </span>
            ) : (
              part
            )
          );
        }
        return segment;
      });
    });
    return renderedText;
  };

  return (
    <span className={`inline-block perspective-1000 ${className}`}>
      <span
        className={`inline-block transform-style-3d transition-transform duration-500 ${
          isFlipping ? 'animate-flip-down-out' : 'animate-flip-down-in'
        }`}
      >
        {renderText(texts[currentIndex])}
      </span>
    </span>
  );
};

export default FlippingText;
