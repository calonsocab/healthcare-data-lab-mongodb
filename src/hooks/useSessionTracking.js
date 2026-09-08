// src/hooks/useSessionTracking.js
/**
 * Hook for tracking user sessions with periodic heartbeats.
 * Sends heartbeats every 5 minutes to track active session duration.
 * Also generates a unique session ID for grouping activity.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Generate a unique session ID
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export function useSessionTracking(currentView = 'unknown') {
  const { data: session, status } = useSession();
  const sessionIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const lastHeartbeatRef = useRef(0);

  // Initialize session ID on mount
  useEffect(() => {
    if (!sessionIdRef.current) {
      // Check sessionStorage first for existing session
      const storedSessionId = sessionStorage.getItem('hdl_session_id');
      if (storedSessionId) {
        sessionIdRef.current = storedSessionId;
      } else {
        sessionIdRef.current = generateSessionId();
        sessionStorage.setItem('hdl_session_id', sessionIdRef.current);
      }
    }
  }, []);

  const sendHeartbeat = useCallback(async (view) => {
    if (status !== 'authenticated' || !session?.user) return;

    // Throttle heartbeats to prevent excessive calls
    const now = Date.now();
    if (now - lastHeartbeatRef.current < 30000) return; // Min 30 seconds between heartbeats
    lastHeartbeatRef.current = now;

    try {
      await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          currentView: view || currentView,
        }),
      });
    } catch (error) {
      console.error('Failed to send session heartbeat:', error);
    }
  }, [status, session, currentView]);

  // Set up periodic heartbeat
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Send initial heartbeat
    sendHeartbeat(currentView);

    // Send heartbeat every 5 minutes
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(currentView);
    }, 5 * 60 * 1000);

    // Cleanup
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [status, currentView, sendHeartbeat]);

  // Track visibility changes (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat(currentView);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentView, sendHeartbeat]);

  return {
    sessionId: sessionIdRef.current,
    sendHeartbeat,
  };
}

export default useSessionTracking;
