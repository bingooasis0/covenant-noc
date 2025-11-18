import React, { useState, useRef, useEffect } from 'react';

/**
 * Custom Tooltip Component
 * Small, clean, simple tooltips for technical fields and controls
 * Supports hover and focus states with intelligent positioning
 */

const Tooltip = ({
  children,
  content,
  position = 'top', // top, bottom, left, right
  delay = 300,
  isDark = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  const theme = isDark ? {
    bg: '#1f2429',
    text: '#e6edf3',
    border: '#30363d',
    shadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
  } : {
    bg: '#24292f',
    text: '#ffffff',
    border: '#57606a',
    shadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
  };

  // Calculate tooltip position
  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8; // Gap between trigger and tooltip
    const viewportPadding = 10; // Padding from viewport edges

    let newPosition = position;
    let top = 0;
    let left = 0;

    // Calculate based on requested position
    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

        // Check if tooltip goes above viewport
        if (top < viewportPadding) {
          newPosition = 'bottom';
          top = triggerRect.bottom + spacing;
        }
        break;

      case 'bottom':
        top = triggerRect.bottom + spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

        // Check if tooltip goes below viewport
        if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
          newPosition = 'top';
          top = triggerRect.top - tooltipRect.height - spacing;
        }
        break;

      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - spacing;

        // Check if tooltip goes left of viewport
        if (left < viewportPadding) {
          newPosition = 'right';
          left = triggerRect.right + spacing;
        }
        break;

      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + spacing;

        // Check if tooltip goes right of viewport
        if (left + tooltipRect.width > window.innerWidth - viewportPadding) {
          newPosition = 'left';
          left = triggerRect.left - tooltipRect.width - spacing;
        }
        break;

      default:
        break;
    }

    // Adjust horizontal position if tooltip goes off screen
    if (left < viewportPadding) {
      left = viewportPadding;
    } else if (left + tooltipRect.width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - tooltipRect.width - viewportPadding;
    }

    // Adjust vertical position if tooltip goes off screen
    if (top < viewportPadding) {
      top = viewportPadding;
    } else if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
      top = window.innerHeight - tooltipRect.height - viewportPadding;
    }

    setActualPosition(newPosition);
    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleFocus = () => {
    setIsVisible(true);
  };

  const handleBlur = () => {
    setIsVisible(false);
  };

  // Recalculate position when tooltip becomes visible
  useEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        calculatePosition();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible]);

  if (!content) return children;

  // Arrow styles based on position
  const getArrowStyle = () => {
    const arrowSize = 6;
    const baseStyle = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    };

    switch (actualPosition) {
      case 'top':
        return {
          ...baseStyle,
          bottom: -arrowSize,
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
          borderColor: `${theme.bg} transparent transparent transparent`,
        };
      case 'bottom':
        return {
          ...baseStyle,
          top: -arrowSize,
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent ${theme.bg} transparent`,
        };
      case 'left':
        return {
          ...baseStyle,
          right: -arrowSize,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent transparent ${theme.bg}`,
        };
      case 'right':
        return {
          ...baseStyle,
          left: -arrowSize,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
          borderColor: `transparent ${theme.bg} transparent transparent`,
        };
      default:
        return baseStyle;
    }
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{ display: 'inline-block' }}
      >
        {children}
      </span>

      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 10000,
            pointerEvents: 'none',
            animation: 'tooltipFadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              position: 'relative',
              backgroundColor: theme.bg,
              color: theme.text,
              padding: '6px 10px',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              fontSize: '12px',
              lineHeight: '1.4',
              maxWidth: '250px',
              wordWrap: 'break-word',
              boxShadow: theme.shadow,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {content}
            <div style={getArrowStyle()} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
};

export default Tooltip;
