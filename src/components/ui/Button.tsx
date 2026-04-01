import React from 'react';
import { cn } from '../../utils/cn.ts';

export const Button = ({ className, variant = 'primary', children, ...props }: any) => {
  const variants = {
    primary: 'bg-lime-600 text-white hover:bg-lime-700',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
  };
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50', 
        variants[variant as keyof typeof variants], 
        className
      )} 
      {...props} 
    >
      {children}
    </button>
  );
};
