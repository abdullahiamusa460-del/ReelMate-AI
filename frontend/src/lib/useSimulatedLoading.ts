"use client";

import { useEffect, useState } from "react";

/**
 * Shows skeleton loading states briefly on first render.
 *
 * There is no network request behind this: the frontend has no backend. It exists so
 * the loading UI is exercised and ready for when real data fetching is wired in.
 */
export function useSimulatedLoading(ms = 650): boolean {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);

  return loading;
}
