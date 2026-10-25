'use client';

import { useId, useRef, type ReactNode } from 'react';

export interface WorkspaceTab {
  id: string;
  label: string;
  content: ReactNode;
  count?: number;
}

// Instant activation: panels stay mounted, so switching tabs never loses a form draft.
export default function WorkspaceTabs({
  label,
  tabs,
  value,
  onChange,
  className = '',
}: {
  label: string;
  tabs: WorkspaceTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  return (
    <div className={`workspace-tabs ${className}`}>
      <div ref={list} role="tablist" aria-label={label} className="workspace-tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.id}`}
            aria-controls={`${id}-panel-${tab.id}`}
            aria-selected={value === tab.id}
            tabIndex={value === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              onChange(tabs[next].id);
              const nextTab = list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]').item(next);
              nextTab?.focus({ preventScroll: true });
              nextTab?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
            }}
          >
            <span className="workspace-tab-label">{tab.label}</span>
            {tab.count !== undefined && <span className="workspace-tab-count">({tab.count})</span>}
          </button>
        ))}
      </div>
      <div className="workspace-tabpanels">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`${id}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${tab.id}`}
            hidden={value !== tab.id}
            tabIndex={0}
            className="workspace-tab-panel"
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
