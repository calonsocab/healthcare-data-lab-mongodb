// src/hooks/useTosAcceptance.js
"use client";

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook to persist ToS acceptance from sessionStorage to the database.
 * Should be called once in the main app layout after successful authentication.
 *
 * Flow:
 * 1. User accepts ToS on login page -> stored in sessionStorage
 * 2. User authenticates and is redirected to app
 * 3. This hook detects the pending ToS acceptance and persists it to DB
 * 4. sessionStorage is cleared after successful persistence
 */
export function useTosAcceptance() {
  const { data: session, status } = useSession();
  const hasPersisted = useRef(false);

  useEffect(() => {
    // Only run once per session, after authentication
    if (status !== 'authenticated' || !session?.user?.email || hasPersisted.current) {
      return;
    }

    const persistTosAcceptance = async () => {
      try {
        // Check for pending ToS acceptance in sessionStorage
        const tosData = sessionStorage.getItem('tosAcceptance');
        if (!tosData) {
          return;
        }

        const { version, acceptedAt } = JSON.parse(tosData);
        if (!version || !acceptedAt) {
          sessionStorage.removeItem('tosAcceptance');
          return;
        }

        // Persist to database
        const response = await fetch('/api/users/tos-acceptance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version, acceptedAt })
        });

        if (response.ok) {
          // Clear from sessionStorage after successful persistence
          sessionStorage.removeItem('tosAcceptance');
          hasPersisted.current = true;
          console.log('ToS acceptance persisted successfully');
        } else {
          console.error('Failed to persist ToS acceptance:', await response.text());
        }
      } catch (error) {
        console.error('Error persisting ToS acceptance:', error);
      }
    };

    persistTosAcceptance();
  }, [session, status]);
}

export default useTosAcceptance;
