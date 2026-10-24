import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Web static rendering has no colour scheme during the server pass, so the first
 * client paint is forced to `light` and corrected after hydration. Without this,
 * the server HTML and the first client render disagree and React logs a
 * hydration mismatch.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
