import React from 'react';
import { cn } from '../../utils/cn.ts';

export const Button = ({ className, variant = 'primary', children, ...props }: any) => {
  const variants = {
    primary:
      'border border-lime-500/80 bg-gradient-to-b from-lime-500 via-lime-600 to-lime-700 text-white shadow-[0_10px_24px_rgba(101,163,13,0.28)] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(101,163,13,0.34)]',
    secondary:
      'border border-gray-200/90 bg-gradient-to-b from-white to-gray-50 text-gray-700 shadow-sm hover:-translate-y-0.5 hover:border-lime-200 hover:bg-lime-50/60 hover:text-lime-700 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]',
    danger:
      'border border-red-500/80 bg-gradient-to-b from-red-500 via-red-600 to-red-700 text-white shadow-[0_10px_24px_rgba(220,38,38,0.24)] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(220,38,38,0.3)]',
    ghost:
      'border border-transparent bg-transparent text-gray-600 hover:-translate-y-0.5 hover:bg-gray-100 hover:text-gray-900',
  };
  return (
    <button 
      className={cn(
        'group inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2 font-medium transition-all duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 group-hover:[&_svg]:scale-110 group-hover:[&_svg]:rotate-[-6deg]', 
        variants[variant as keyof typeof variants], 
        className
      )} 
      {...props} 
    >
      {children}
    </button>
  );
};
