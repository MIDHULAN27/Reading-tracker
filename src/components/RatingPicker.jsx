import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function RatingPicker({ rating, onChange, maxStars = 5, size = 6, readOnly = false }) {
  const [hoverRating, setHoverRating] = useState(0);

  const stars = Array.from({ length: maxStars }, (_, index) => index + 1);

  const handleClick = (value) => {
    if (readOnly || !onChange) return;
    onChange(value);
  };

  const handleMouseEnter = (value) => {
    if (readOnly) return;
    setHoverRating(value);
  };

  const handleMouseLeave = () => {
    if (readOnly) return;
    setHoverRating(0);
  };

  return (
    <div className="flex items-center gap-1.5" onMouseLeave={handleMouseLeave}>
      {stars.map((starValue) => {
        const isFilled = hoverRating > 0 ? starValue <= hoverRating : starValue <= rating;
        return (
          <button
            key={starValue}
            type="button"
            disabled={readOnly}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => handleMouseEnter(starValue)}
            className={`transition-all duration-200 focus:outline-none ${
              readOnly ? 'cursor-default' : 'hover:scale-125 cursor-pointer'
            }`}
          >
            <Star
              className={`w-${size} h-${size} ${
                isFilled 
                  ? 'fill-cozy-amber text-cozy-amber filter drop-shadow-[0_0_2px_rgba(217,119,6,0.5)]' 
                  : 'text-cozy-night-100/25 dark:text-cozy-cream-200/20'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
