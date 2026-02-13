import React from 'react';
import { cn } from '../../lib/utils';
import './badge.css';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
    return (
        <div className={cn('badge', `badge-${variant}`, className)} {...props} />
    );
}
