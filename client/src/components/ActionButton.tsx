import type { ReactNode } from 'react';

interface ActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'outline' | 'icon';
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  active = false,
  disabled = false,
  className = '',
}: ActionButtonProps) {
  const baseClass = 'action-btn';
  const variantClass = variant === 'outline' ? 'outline' : variant === 'icon' ? 'icon' : 'primary';
  const activeClass = active ? 'active' : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${activeClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
