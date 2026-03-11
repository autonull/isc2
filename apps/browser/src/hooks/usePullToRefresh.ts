import { useEffect, useRef, useCallback } from 'preact/hooks';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxDrag?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxDrag = 200,
}: PullToRefreshOptions) {
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const contentRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      isDragging.current = true;
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current) return;

      currentY.current = e.touches[0].clientY;
      const dragDistance = currentY.current - startY.current;

      if (dragDistance > 0 && dragDistance <= maxDrag) {
        e.preventDefault();
        const opacity = Math.min(dragDistance / threshold, 1);
        if (contentRef.current) {
          contentRef.current.style.transform = `translateY(${dragDistance}px)`;
          contentRef.current.style.opacity = String(1 - opacity * 0.3);
        }
      }
    },
    [maxDrag, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;

    const dragDistance = currentY.current - startY.current;

    if (contentRef.current) {
      contentRef.current.style.transform = '';
      contentRef.current.style.opacity = '';
    }

    isDragging.current = false;

    if (dragDistance > threshold) {
      await onRefresh();
    }

    startY.current = 0;
    currentY.current = 0;
  }, [onRefresh, threshold]);

  useEffect(() => {
    const content = document.querySelector('.app-content') as HTMLElement | null;
    if (!content) return;

    contentRef.current = content;

    content.addEventListener('touchstart', handleTouchStart, { passive: true });
    content.addEventListener('touchmove', handleTouchMove, { passive: false });
    content.addEventListener('touchend', handleTouchEnd);

    return () => {
      content.removeEventListener('touchstart', handleTouchStart);
      content.removeEventListener('touchmove', handleTouchMove);
      content.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}
