'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import SidebarItem from './SidebarItem';
import BrandLogo from '@/components/BrandLogo';
import AdminIcon from '@/components/Admin/AdminIcon';
import { adminNavigation } from '@/components/Admin/navigation';
import { useState } from 'react';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const t = useTranslations('adminNavigation'),
    workspace = useTranslations('adminWorkspace');
  const ux = useTranslations('commerceUX');
  const [query, setQuery] = useState('');
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  const matches = (value: string) => normalize(value).includes(normalize(query.trim()));
  const searchResults = adminNavigation
    .flatMap((group) =>
      group.items.flatMap((item) =>
        'children' in item && item.children
          ? item.children.map((child) => ({ ...child, icon: item.icon }))
          : [{ label: item.label, route: item.route, icon: item.icon }],
      ),
    )
    .filter((item) => matches(t(item.label)));
  return (
    <aside id="sidebar" className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
      <div className="admin-sidebar-brand">
        <div>
          <BrandLogo href="/admin/dashboard" />
          <span className="admin-brand-caption">{workspace('workspace')}</span>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label={t('closeMenu')}
          className="admin-sidebar-close"
        >
          <AdminIcon name="close" />
        </button>
      </div>
      <div className="admin-sidebar-scroll">
        <div className="admin-nav-search">
          <AdminIcon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setQuery('');
              }
            }}
            aria-label={ux('findWorkspace')}
            placeholder={ux('findWorkspace')}
          />
        </div>
        <nav
          aria-label={t('menu')}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setSidebarOpen(false);
          }}
        >
          {query.trim() ? (
            <ul className="admin-nav-search-results">
              {searchResults.map((item) => (
                <li key={item.route}>
                  <Link href={item.route} className="admin-nav-item" onClick={() => setQuery('')}>
                    <AdminIcon name={item.icon} size={18} />
                    {t(item.label)}
                  </Link>
                </li>
              ))}
              {searchResults.length === 0 && <li className="admin-nav-no-results">{ux('noWorkspace')}</li>}
            </ul>
          ) : (
            adminNavigation.map((group) => (
              <div key={group.name} className="admin-nav-group">
                <h3>{t(group.name)}</h3>
                <ul>
                  {group.items.map((item) => (
                    <SidebarItem
                      key={item.label}
                      item={{
                        ...item,
                        icon: <AdminIcon name={item.icon} size={18} />,
                        label: t(item.label),
                        children:
                          'children' in item
                            ? item.children?.map((child) => ({ ...child, label: t(child.label) }))
                            : undefined,
                      }}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
        <Link href="/" className="admin-store-link">
          <AdminIcon name="box" size={18} />
          {t('store')}
          <AdminIcon name="arrow" size={16} />
        </Link>
      </div>
    </aside>
  );
}
