import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';

interface TourGuideAvatarProps {
  title: string;
  message: string;
}

export const TourGuideAvatar = ({ title, message }: TourGuideAvatarProps) => (
  <div className="flex items-start gap-3">
    <div className="relative shrink-0">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-lime-200 via-emerald-100 to-white shadow-md ring-4 ring-lime-50">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-lime-600 text-white shadow-inner">
          <BookOpen className="h-5 w-5" />
        </div>
      </div>
      <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white shadow">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
    </div>
    <div className="relative flex-1 rounded-2xl border border-lime-100 bg-lime-50/70 px-4 py-3">
      <div className="absolute -left-2 top-5 h-4 w-4 rotate-45 border-b border-l border-lime-100 bg-lime-50/70" />
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-lime-700">Guia da Biblioteca</p>
      <h4 className="mt-1 text-base font-bold text-gray-900">{title}</h4>
      <p className="mt-1 text-sm leading-6 text-gray-700">{message}</p>
    </div>
  </div>
);

export default TourGuideAvatar;
