import React from 'react';
import { cn } from '../../lib/utils';
import './button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'btn',
                    `btn-${variant}`,
                    `btn-${size}`,
                    className
                )}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading ? (
                    <span className="animate-spin mr-2">⏳</span> /* Replace with proper spinner if needed */
                ) : null}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
