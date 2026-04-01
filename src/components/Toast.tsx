import React, { useEffect } from 'react';

interface ToastProps {
  title: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast = ({ title, message, onClose, duration = 4000 }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="bg-white border border-lime-100 shadow-lg rounded-xl p-4 w-80">
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-gray-600">{message}</p>
    </div>
  );
};
