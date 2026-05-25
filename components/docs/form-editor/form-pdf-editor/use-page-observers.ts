import { useEffect, useRef, useState } from "react";

export function usePageObservers(
  pageNumber: number,
  onVisible: (page: number) => void,
  registerPageRef: (page: number, node: HTMLDivElement | null) => void
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerResizeVersion, setContainerResizeVersion] = useState<number>(0);

  useEffect(
    () => registerPageRef(pageNumber, containerRef.current),
    [pageNumber, registerPageRef]
  );

  // Detect when the PDF container changes size (panel resize) and trigger position recalculation
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(() => {
      setContainerResizeVersion((prev) => prev + 1);
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) onVisible(pageNumber);
        });
      },
      { threshold: 0.6 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible, pageNumber]);

  return { containerRef, containerResizeVersion };
}
