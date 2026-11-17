import { useEffect, useState } from 'react';

import { getProfile } from '../api/profileApi';
import { useAuth } from './useAuth';

/** Shared exercise demos can be replaced only by an admin account. */
export function useIsWorkoutAdmin() {
  const { isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (!cancelled) setIsAdmin(profile.role === 'admin');
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return isAdmin;
}
