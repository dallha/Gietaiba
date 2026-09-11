import React from 'react';

interface TaibaLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon';
  alt?: string;
  withContainer?: boolean;
}

const SIZE_MAP = {
  xs: { height: 28, width: 28 },
  sm: { height: 36, width: 36 },
  md: { height: 48, width: 48 },
  lg: { height: 72, width: 72 },
  xl: { height: 110, width: 110 },
};

/**
 * Composant de marque officiel GIE TAIBA VOYAGES.
 * Préserve rigoureusement les couleurs d'origine (Or #EAA824, Noir #18181B, Blanc #FFFFFF).
 */
export const TaibaLogo: React.FC<TaibaLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  alt = 'GIE TAIBA VOYAGES',
  withContainer = false,
}) => {
  const dimensions = SIZE_MAP[size] || SIZE_MAP.md;

  const content = (
    <div
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{
        width: variant === 'icon' ? dimensions.width : 'auto',
        height: dimensions.height,
      }}
      role="img"
      aria-label={alt}
    >
      <img
        src="/assets/logo-taiba.svg"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/logo-taiba.svg';
        }}
        alt={alt}
        className="h-full w-auto object-contain"
        style={{ maxHeight: dimensions.height }}
      />
    </div>
  );

  if (withContainer) {
    return (
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};
