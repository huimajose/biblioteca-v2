import React from 'react';
import { cn } from '../../utils/cn.ts';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ children, className }: CardProps) => (
  <div className={cn('bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);
