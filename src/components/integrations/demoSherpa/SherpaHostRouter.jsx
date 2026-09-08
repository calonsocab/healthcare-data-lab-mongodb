"use client";

import { useEffect, useRef } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { sherpaPathToView, viewToSherpaPath } from '@/lib/demoSherpa/hostRoutes';

function SherpaRouteSync({ currentView, onNavigate, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastLocationPathRef = useRef(location.pathname);
  const syncingFromLocationRef = useRef(false);

  useEffect(() => {
    const locationChanged = lastLocationPathRef.current !== location.pathname;
    lastLocationPathRef.current = location.pathname;
    if (!locationChanged) return;

    const viewFromPath = sherpaPathToView(location.pathname);
    if (viewFromPath && viewFromPath !== currentView) {
      syncingFromLocationRef.current = true;
      onNavigate(viewFromPath);
    }
  }, [currentView, location.pathname, onNavigate]);

  useEffect(() => {
    const desiredPath = viewToSherpaPath(currentView);
    if (location.pathname === desiredPath) {
      syncingFromLocationRef.current = false;
      return;
    }

    if (syncingFromLocationRef.current) return;
    navigate(desiredPath);
  }, [currentView, location.pathname, navigate]);

  return children;
}

export default function SherpaHostRouter({ currentView, onNavigate, children }) {
  return (
    <BrowserRouter>
      <SherpaRouteSync currentView={currentView} onNavigate={onNavigate}>
        {children}
      </SherpaRouteSync>
    </BrowserRouter>
  );
}
