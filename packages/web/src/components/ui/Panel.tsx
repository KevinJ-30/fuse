import { ReactNode, MouseEvent } from 'react';
import './Panel.css';

interface PanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: 'brand' | 'subtle' | 'none';
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export function Panel({ children, className = '', hover = true, gradient = 'subtle', onClick }: PanelProps) {
  const gradientClass = gradient === 'brand' ? 'panel-brand' : gradient === 'subtle' ? 'panel-subtle' : '';
  const hoverClass = hover ? 'panel-hover' : '';

  return (
    <div className={`panel ${gradientClass} ${hoverClass} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
