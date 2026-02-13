import React from 'react';
import { cn } from '../../lib/utils';
import './input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="input-container">
                {label && <label className="input-label">{label}</label>}
                <div className="input-wrapper">
                    <input
                        ref={ref}
                        className={cn('input-field', error ? 'border-destructive' : '', className)}
                        {...props}
                    />
                </div>
                {error && <span className="input-error-msg">{error}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';
