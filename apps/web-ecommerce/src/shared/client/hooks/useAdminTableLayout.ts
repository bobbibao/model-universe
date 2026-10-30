'use client';
import { useEffect, useState, type RefObject } from 'react';
import { catalogTableLayout } from '@/shared/catalog-table-layout';

export default function useAdminTableLayout(workspaceRef: RefObject<HTMLDivElement | null>) {
  const [pageSize, setPageSize] = useState(0);
  useEffect(() => {
    const workspace = workspaceRef.current;
    const region = workspace?.querySelector<HTMLElement>('.admin-table-scroll');
    if (!workspace || !region) return;
    let frame = 0;
    const measure = () => {
      if (window.matchMedia('(max-width: 767px)').matches) {
        workspace.style.removeProperty('--catalog-row-height');
        setPageSize(10);
        return;
      }
      const header = region.querySelector('thead')?.getBoundingClientRect().height ?? 44;
      const layout = catalogTableLayout(region.clientHeight - header);
      if (!layout) return;
      workspace.style.setProperty('--catalog-row-height', `${layout.rowHeight}px`);
      setPageSize(layout.pageSize);
    };
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(region);
    const header = region.querySelector('thead');
    if (header) observer.observe(header);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, [workspaceRef]);
  return pageSize;
}
