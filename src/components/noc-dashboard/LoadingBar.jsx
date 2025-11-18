import React, { useEffect, useMemo } from 'react';

const BORDER_COLOR = '#657184';
const FILL_COLOR = '#96ADD1';
const SPEED = 1.3; // seconds per cycle

const hexToRgba = (hex, alpha) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const LoadingBar = ({
  width = '60%',
  height = 10,
  borderColor = BORDER_COLOR,
  fillColor = FILL_COLOR,
  speed = SPEED,
  style
}) => {
  const className = useMemo(() => `loading-bar-${Math.random().toString(36).slice(2, 8)}`, []);
  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const borderRadius = Math.max(height / 2, 6);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-loading-bar', className);
    styleEl.textContent = `
      .${className} {
        position: relative;
        width: ${widthValue};
        height: ${height}px;
        border-radius: ${borderRadius}px;
        background: ${hexToRgba(borderColor, 0.12)};
        border: 1px solid ${hexToRgba(borderColor, 0.45)};
        overflow: hidden;
        box-shadow: inset 0 1px 2px ${hexToRgba('#000000', 0.25)};
      }
      .${className}::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(0deg, ${hexToRgba(fillColor, 0.18)} 0%, ${hexToRgba(fillColor, 0.05)} 100%);
        opacity: 0.6;
      }
      .${className}::before {
        content: '';
        position: absolute;
        inset: -2px;
        background: linear-gradient(90deg,
          rgba(255,255,255,0) 0%,
          ${hexToRgba(fillColor, 0.2)} 20%,
          ${fillColor} 50%,
          ${hexToRgba(fillColor, 0.2)} 80%,
          rgba(255,255,255,0) 100%);
        animation: ${className}-scan ${Math.max(0.4, speed)}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        transform: translateX(-100%);
        filter: drop-shadow(0 0 6px ${hexToRgba(fillColor, 0.35)});
      }
      @keyframes ${className}-scan {
        0% { transform: translateX(-120%); opacity: 0.15; }
        30% { opacity: 0.8; }
        70% { opacity: 0.95; }
        100% { transform: translateX(120%); opacity: 0.15; }
      }
    `;

    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, [className, widthValue, height, borderColor, fillColor, speed, borderRadius]);

  return <div className={className} style={style} aria-hidden="true" />;
};

export default LoadingBar;
