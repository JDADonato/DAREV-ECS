import React, { useState } from 'react';

const OptimizedImage = ({ src, alt, className = '', containerClassName = '' }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Simple blurhash/placeholder styles. 
    // In a real app, you can pass a tiny base64 placeholder or use a skeleton.
    return (
        <div className={`relative overflow-hidden ${containerClassName}`}>
            {/* Blurry Placeholder/Skeleton */}
            <div 
                className={`absolute inset-0 bg-gray-200 animate-pulse transition-opacity duration-500 ${isLoaded ? 'opacity-0' : 'opacity-100'}`}
                aria-hidden="true"
            />
            
            <img
                src={hasError ? '/images/fallback-image.png' : src}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={() => setIsLoaded(true)}
                onError={() => {
                    setIsLoaded(true);
                    setHasError(true);
                }}
                className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
            />
        </div>
    );
};

export default OptimizedImage;
