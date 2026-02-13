import React from 'react';
import { cn } from '../../lib/utils';
import './card.css';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('card', className)} {...props}>{children}</div>;
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('card-header', className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h3 className={cn('card-title', className)} {...props}>{children}</h3>;
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn('card-description', className)} {...props}>{children}</p>;
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('card-content', className)} {...props}>{children}</div>;
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('card-footer', className)} {...props}>{children}</div>;
}
