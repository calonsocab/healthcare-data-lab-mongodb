// src/components/ui/LoadingScreen.jsx
"use client";

import AnimatedLogo from '@/components/views/login/AnimatedLogo';

export default function LoadingScreen({ message = "Loading...", fullScreen = true }) {
  // Use inline style with fallback for when CSS variables aren't yet available
  const baseStyle = { backgroundColor: 'var(--color-background, #0F172A)' };

  const containerClass = fullScreen
    ? "fixed inset-0 z-50 flex items-center justify-center"
    : "w-full h-full min-h-[200px] flex items-center justify-center rounded-xl";

  return (
    <div className={containerClass} style={baseStyle}>
      <div className="text-center">
        <AnimatedLogo className="w-20 h-20 mx-auto" />
        <p className="mt-4 text-slate-400 text-sm">
          {message}
        </p>
      </div>
    </div>
  );
}
