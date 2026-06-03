import { useEffect, useRef, type RefObject } from 'react';

interface InfiniteScrollOptions {
  onIntersect: () => void;
  enabled: boolean;
  rootMargin?: string;
}

// Fire `onIntersect` when the referenced sentinel scrolls into view. The
// callback is kept in a ref so a new closure each render doesn't tear down and
// re-create the observer. `enabled` gates it (e.g. hasNextPage && !isFetching).
export function useInfiniteScroll(
  ref: RefObject<Element | null>,
  { onIntersect, enabled, rootMargin = '200px' }: InfiniteScrollOptions,
) {
  const cbRef = useRef(onIntersect);
  cbRef.current = onIntersect;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cbRef.current();
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled, rootMargin]);
}
