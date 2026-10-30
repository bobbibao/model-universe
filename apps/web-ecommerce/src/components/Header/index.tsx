'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import DarkModeSwitcher from './DarkModeSwitcher';
import DropdownUser from './DropdownUser';
import AgentInboxBadge from '@/core/client/features/agent-console/components/AgentInboxBadge';
import AdminCommandMenu from '@/components/Admin/AdminCommandMenu';
import AdminIcon from '@/components/Admin/AdminIcon';
import AdminAssistant from '@/components/Admin/AdminAssistant';
import { adminDestination, hasInlineAdminAssistant } from '@/components/Admin/navigation';

export default function Header({
  sidebarOpen,
  setSidebarOpen,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const t = useTranslations('adminNavigation'),
    workspace = useTranslations('adminWorkspace');
  const pathname = usePathname(),
    destination = adminDestination(pathname);

  return (
    <header className="admin-header">
      <div className="admin-header-location">
        <button
          type="button"
          aria-controls="sidebar"
          aria-label={t('menu')}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="admin-menu-trigger"
        >
          <AdminIcon name="menu" />
        </button>
        <div className="admin-location">
          <span>{workspace('workspace')}</span>
          <strong>{destination ? t(destination.label) : workspace('workspace')}</strong>
        </div>
      </div>
      <div className="admin-header-actions">
        <AdminCommandMenu />
        {hasInlineAdminAssistant(pathname) && <AdminAssistant inline />}
        <ul className="admin-header-tools">
          <DarkModeSwitcher />
          <li>
            <AgentInboxBadge />
          </li>
        </ul>
        <DropdownUser />
      </div>
    </header>
  );
}
