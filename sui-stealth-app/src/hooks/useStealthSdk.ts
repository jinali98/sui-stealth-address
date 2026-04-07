import { useState, useEffect } from 'react';
import { initSdk } from '../lib/stealth';

export function useStealthSdk() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initSdk()
      .then(() => setIsReady(true))
      .catch((e: Error) => setError(e.message));
  }, []);

  return { isReady, error };
}
