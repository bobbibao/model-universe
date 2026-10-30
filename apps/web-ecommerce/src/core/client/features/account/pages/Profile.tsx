'use client';

import '@/css/account-hub.css';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import UserApi from '@/core/client/api/User';
import AdminIcon from '@/components/Admin/AdminIcon';
import SignOutButton from '@/components/StoreHeader/SignOutButton';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { useCustomerAssistant } from '@/shared/client/providers/CustomerAssistantProvider';
import type { User } from '@/shared/types/user';
import type { LoyaltyOverview } from '@/shared/types/loyalty';
import FieldModal from '../components/FieldModal';
import PasswordModal from '../components/PasswordModal';

function PanelLoading() {
  const t = useTranslations('common');
  return (
    <p className="account-loading" role="status">
      {t('loading')}
    </p>
  );
}
const Membership = dynamic(() => import('../../loyalty/Membership'), { loading: PanelLoading, ssr: false });
const Orders = dynamic(() => import('./OrderHistory'), { loading: PanelLoading, ssr: false });
const Addresses = dynamic(() => import('./AddressBook'), { loading: PanelLoading, ssr: false });
const Inbox = dynamic(() => import('./CustomerInbox'), { loading: PanelLoading, ssr: false });
const sections = [
  ['overview', 'dashboard'],
  ['account', 'users'],
  ['membership', 'spark'],
  ['orders', 'orders'],
  ['addresses', 'truck'],
  ['inbox', 'megaphone'],
  ['support', 'book'],
] as const;
type Section = (typeof sections)[number][0];
type EditableField = 'lastName' | 'firstName' | 'phone' | 'address';
const fields: EditableField[] = ['lastName', 'firstName', 'phone', 'address'];

function AccountWorkspace({ user }: { user: User }) {
  const t = useTranslations('accountHub'),
    tierNames = useTranslations('tiers'),
    profile = useTranslations('profile'),
    loyalty = useTranslations('loyalty');
  const common = useTranslations('common'),
    locale = useLocale();
  const { setUser } = useCurrentUser();
  const assistant = useCustomerAssistant();
  const search = useSearchParams();
  const requested = search.get('section');
  const section: Section = sections.some(([key]) => key === requested) ? (requested as Section) : 'overview';
  const [visited, setVisited] = useState<Section[]>([section]);
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [overview, setOverview] = useState<LoyaltyOverview>();
  const [failed, setFailed] = useState(false);
  const loadMembership = useCallback(async () => {
    setFailed(false);
    try {
      setOverview((await Api.get('/loyalty')).data);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void loadMembership();
  }, [loadMembership]);
  useEffect(() => {
    setVisited((current) => (current.includes(section) ? current : [...current, section]));
  }, [section]);
  const fullName = `${user.lastName} ${user.firstName}`.trim();
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'MU';
  const completed = fields.filter((key) => user[key]?.trim()).length;
  const href = (key: Section) => `/user-profile?section=${key}`;
  const saveField = async (value: string) => {
    if (!editing) return false;
    const updated = await UserApi.updateProfile({ [editing]: value });
    if (updated) {
      setUser(updated);
      void loadMembership();
    }
    return Boolean(updated);
  };

  return (
    <div className="mu-wrap account-hub">
      <header className="account-heading">
        <div>
          <p className="studio-kicker">MODEL UNIVERSE / {t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p>{t('intro')}</p>
        </div>
        <Link href="/cua-hang" className="account-shop-link">
          {t('backToShop')} <AdminIcon name="arrow" size={18} />
        </Link>
      </header>
      <div className="account-layout">
        <aside className="account-sidebar">
          <div className="account-identity">
            <span className="account-avatar" aria-hidden="true">
              {initials}
            </span>
            <div>
              <strong>{fullName || user.email}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <nav aria-label={profile('navigation')}>
            {sections.map(([key, icon]) => (
              <Link
                key={key}
                id={`account-nav-${key}`}
                href={href(key)}
                scroll={false}
                aria-current={section === key ? 'page' : undefined}
              >
                <AdminIcon name={icon} size={19} />
                {t(`sections.${key}`)}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
            <Link href="/reservations">
              <AdminIcon name="calendar" size={19} />
              {t('services.reservations')}
              <span aria-hidden="true">↗</span>
            </Link>
          </nav>
          <div className="account-session">
            <span>
              <AdminIcon name="shield" size={16} />
              {t('sessionNote')}
            </span>
            <SignOutButton />
            {user.role === 'ADMIN' && <Link href="/admin/dashboard">{t('adminWorkspace')} ↗</Link>}
          </div>
        </aside>
        <div className="account-content">
          {(visited.includes('overview') || section === 'overview') && (
            <section hidden={section !== 'overview'} aria-labelledby="account-nav-overview" className="account-panel">
              <div className="account-overview-grid">
                <article className="account-member-card">
                  <div className="account-card-top">
                    <span>MODEL UNIVERSE</span>
                    <AdminIcon name="spark" size={26} />
                  </div>
                  <p>{t('memberPass')}</p>
                  <h2>{overview ? tierNames(overview.balances.tier.name) : failed ? t('unavailable') : common('loading')}</h2>
                  <strong className="account-pass-name">{fullName || user.email}</strong>
                  <div className="account-card-bottom">
                    <span>{t('collectorId', { id: user.id })}</span>
                    <Link href={href('membership')} scroll={false}>
                      {t('manageMembership')} ↗
                    </Link>
                  </div>
                </article>
                <article className="account-card account-next-build">
                  <span className="account-icon">
                    <AdminIcon name="box" size={26} />
                  </span>
                  <p className="studio-kicker">{t('nextBuildEyebrow')}</p>
                  <h2>{t('nextBuildTitle')}</h2>
                  <p>{t('nextBuildIntro')}</p>
                  <Link className="studio-text-link" href="/cua-hang#filter-q">
                    {t('findKit')} <AdminIcon name="arrow" size={18} />
                  </Link>
                </article>
              </div>
              <div className="account-stats" aria-label={t('pointsOverview')}>
                {(['available', 'lifetime', 'used', 'debt'] as const).map((key) => (
                  <article className="account-card" key={key}>
                    <span>{loyalty(key)}</span>
                    <strong>{overview ? overview.balances[key].toLocaleString(locale) : '—'}</strong>
                  </article>
                ))}
              </div>
              {failed && (
                <p role="alert" className="account-notice">
                  {t('membershipFailed')} <button onClick={() => void loadMembership()}>{common('retry')}</button>
                </p>
              )}
              {overview && !overview.active && (
                <p role="status" className="account-notice">
                  {loyalty('policyPending')}
                </p>
              )}
              {overview?.balances.nextTier && (
                <article className="account-card account-progress">
                  <div>
                    <h2>{t('nextMilestone')}</h2>
                    <p>
                      {loyalty('nextTier', {
                        tier: tierNames(overview.balances.nextTier.name),
                        points: Math.max(0, overview.balances.nextTier.points - overview.balances.lifetime),
                      })}
                    </p>
                  </div>
                  <progress
                    value={overview.balances.lifetime}
                    max={overview.balances.nextTier.points}
                    aria-label={loyalty('progress')}
                  />
                  <Link href={href('membership')} scroll={false}>
                    {t('viewBenefits')} ↗
                  </Link>
                </article>
              )}
              <div className="account-section-heading">
                <h2>{t('quickActions')}</h2>
                <span>{t('quickActionsNote')}</span>
              </div>
              <div className="account-quick-grid">
                {(['orders', 'addresses', 'inbox', 'support'] as const).map((key) => (
                  <Link className="account-card account-quick-link" href={href(key)} scroll={false} key={key}>
                    <AdminIcon name={sections.find(([name]) => name === key)![1]} size={23} />
                    <strong>{t(`sections.${key}`)}</strong>
                    <span>{t(`descriptions.${key}`)}</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
              <div className="account-section-heading">
                <h2>{t('collectorServices')}</h2>
                <Link href="/services">{t('allServices')} ↗</Link>
              </div>
              <div className="account-service-links">
                {[
                  ['sell', 'exchange'],
                  ['pawn', 'shield'],
                  ['reservations', 'calendar'],
                ].map(([key, icon]) => (
                  <Link href={key === 'reservations' ? '/reservations' : `/services/${key}`} key={key}>
                    <AdminIcon name={icon} size={22} />
                    <div>
                      <strong>{t(`services.${key}`)}</strong>
                      <span>{t(`serviceNotes.${key}`)}</span>
                    </div>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {(visited.includes('account') || section === 'account') && (
            <section hidden={section !== 'account'} aria-labelledby="account-nav-account" className="account-panel">
              {/* Account Overview Hero Card */}
              <div className="account-identity-banner mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark sm:p-7">
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-xl font-extrabold text-white shadow-md sm:h-20 sm:w-20 sm:text-2xl">
                    {initials}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                        {fullName || user.email}
                      </h2>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        {user.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên chính thức'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Mã thành viên: <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">#CLT-{String(user.id).padStart(5, '0')}</span> · {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-1.5 sm:items-end">
                  <span className="account-completion rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                    {t('completion', { count: completed, total: fields.length })}
                  </span>
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-meta-4">
                    <div
                      className="h-full rounded-full bg-purple-600 transition-all duration-500"
                      style={{ width: `${(completed / fields.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Account Details & Contact Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* 1. Personal Information */}
                <article className="account-card flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark">
                  <div>
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-strokedark">
                      <div className="flex items-center gap-2">
                        <AdminIcon name="users" size={18} />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Thông tin cá nhân</h3>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">Hồ sơ người dùng</span>
                    </div>

                    <div className="space-y-3">
                      {/* Last Name */}
                      <button
                        type="button"
                        onClick={() => setEditing('lastName')}
                        aria-label={profile('updateField', { field: profile('lastName') })}
                        className="group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-meta-4"
                      >
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{profile('lastName')}</span>
                          <strong className="block text-sm font-bold text-slate-800 dark:text-white">{user.lastName || profile('unknown')}</strong>
                        </div>
                        <span className="text-xs font-semibold text-purple-600 opacity-80 group-hover:opacity-100 dark:text-purple-400">{t('edit')} ↗</span>
                      </button>

                      {/* First Name */}
                      <button
                        type="button"
                        onClick={() => setEditing('firstName')}
                        aria-label={profile('updateField', { field: profile('firstName') })}
                        className="group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-meta-4"
                      >
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{profile('firstName')}</span>
                          <strong className="block text-sm font-bold text-slate-800 dark:text-white">{user.firstName || profile('unknown')}</strong>
                        </div>
                        <span className="text-xs font-semibold text-purple-600 opacity-80 group-hover:opacity-100 dark:text-purple-400">{t('edit')} ↗</span>
                      </button>

                      {/* Gender */}
                      <div className="flex items-center justify-between rounded-xl p-2.5">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{profile('gender')}</span>
                          <strong className="block text-sm font-bold text-slate-800 dark:text-white">
                            {user.gender === 'M' ? profile('male') : user.gender === 'F' ? profile('female') : profile('unknown')}
                          </strong>
                        </div>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-meta-4 dark:text-slate-400">
                          Mặc định
                        </span>
                      </div>
                    </div>
                  </div>
                </article>

                {/* 2. Contact & Delivery Info */}
                <article className="account-card flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark">
                  <div>
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-strokedark">
                      <div className="flex items-center gap-2">
                        <AdminIcon name="truck" size={18} />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Liên hệ & Giao nhận</h3>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">Thông tin xác thực</span>
                    </div>

                    <div className="space-y-3">
                      {/* Email */}
                      <div className="flex items-center justify-between rounded-xl p-2.5">
                        <div className="min-w-0 pr-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Email tài khoản</span>
                          <strong className="block truncate text-sm font-bold text-slate-800 dark:text-white">{user.email}</strong>
                          <span className="text-[11px] text-slate-400">{t('emailNote')}</span>
                        </div>
                        <span className="flex-shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          ✓ Đã xác thực
                        </span>
                      </div>

                      {/* Phone */}
                      <button
                        type="button"
                        onClick={() => setEditing('phone')}
                        aria-label={profile('updateField', { field: profile('phone') })}
                        className="group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-meta-4"
                      >
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{profile('phone')}</span>
                          <strong className="block text-sm font-bold text-slate-800 dark:text-white">{user.phone || profile('unknown')}</strong>
                        </div>
                        <span className="text-xs font-semibold text-purple-600 opacity-80 group-hover:opacity-100 dark:text-purple-400">{t('edit')} ↗</span>
                      </button>

                      {/* Address */}
                      <button
                        type="button"
                        onClick={() => setEditing('address')}
                        aria-label={profile('updateField', { field: profile('address') })}
                        className="group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-meta-4"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{profile('address')}</span>
                          <strong className="block truncate text-sm font-bold text-slate-800 dark:text-white">{user.address || profile('unknown')}</strong>
                        </div>
                        <span className="text-xs font-semibold text-purple-600 opacity-80 group-hover:opacity-100 dark:text-purple-400">{t('edit')} ↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              </div>

              {/* Security & Sessions Bottom Cards */}
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {/* Security Card */}
                <article className="account-card flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                      <AdminIcon name="shield" size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('securityTitle')}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('securityIntro')}</p>
                      <p className="mt-2 text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                        Mật khẩu: ••••••••••••
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4 dark:border-strokedark">
                    <button
                      type="button"
                      className="mu-button w-full sm:w-auto"
                      onClick={() => setChangingPassword(true)}
                    >
                      {profile('changePassword')}
                    </button>
                  </div>
                </article>

                {/* Session & Signout Card */}
                <article className="account-card flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('sessionTitle')}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('signoutNote')}</p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Đang đăng nhập an toàn với JWT và cookie bảo mật HttpOnly.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4 dark:border-strokedark">
                    <SignOutButton />
                  </div>
                </article>
              </div>
            </section>
          )}
          {(['membership', 'orders', 'addresses', 'inbox'] as const).map(
            (key) =>
              (visited.includes(key) || section === key) && (
                <section
                  key={key}
                  hidden={section !== key}
                  aria-labelledby={`account-nav-${key}`}
                  className="account-panel account-embedded"
                >
                  {key === 'membership' && <Membership embedded onChange={setOverview} />}
                  {key === 'orders' && <Orders embedded />}
                  {key === 'addresses' && <Addresses embedded />}
                  {key === 'inbox' && <Inbox embedded />}
                </section>
              ),
          )}
          {(visited.includes('support') || section === 'support') && (
            <section hidden={section !== 'support'} aria-labelledby="account-nav-support" className="account-panel">
              <article className="account-support-hero">
                <span className="account-icon">
                  <AdminIcon name="spark" size={28} />
                </span>
                <p className="studio-kicker">{t('supportEyebrow')}</p>
                <h2>{t('supportTitle')}</h2>
                <p>{t('supportIntro')}</p>
                <button className="mu-button" onClick={() => assistant.open()}>
                  {t('openAssistant')} <AdminIcon name="arrow" size={18} />
                </button>
              </article>
              <div className="account-quick-grid account-support-links">
                <Link href={href('orders')} scroll={false} className="account-card">
                  <AdminIcon name="orders" />
                  <h3>{t('orderHelp')}</h3>
                  <p>{t('orderHelpIntro')}</p>
                </Link>
                <Link href="/contact" className="account-card">
                  <AdminIcon name="book" />
                  <h3>{t('contactShop')}</h3>
                  <p>{t('contactIntro')}</p>
                </Link>
              </div>
              <article className="account-card account-help">
                <h2>{t('helpTitle')}</h2>
                {['points', 'returns', 'address'].map((key) => (
                  <details key={key}>
                    <summary>{t(`help.${key}.question`)}</summary>
                    <p>{t(`help.${key}.answer`)}</p>
                  </details>
                ))}
              </article>
            </section>
          )}
        </div>
      </div>
      <FieldModal
        open={Boolean(editing)}
        label={editing ? profile(editing) : ''}
        initialValue={editing ? user[editing] || '' : ''}
        onClose={() => setEditing(null)}
        onSave={saveField}
      />
      <PasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}

export default function Profile() {
  const t = useTranslations('accountHub'),
    profile = useTranslations('profile');
  const { user, loading } = useCurrentUser();
  if (loading)
    return (
      <div className="mu-wrap account-hub">
        <PanelLoading />
      </div>
    );
  if (!user)
    return (
      <section className="mu-wrap account-hub account-guest">
        <span className="account-avatar" aria-hidden="true">
          <AdminIcon name="users" size={32} />
        </span>
        <p className="studio-kicker">MODEL UNIVERSE / {t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p>{t('guestIntro')}</p>
        <Link href="/auth/signin?redirect=/user-profile" className="mu-button">
          {profile('signIn')} <AdminIcon name="arrow" size={18} />
        </Link>
        <Link href="/contact" className="studio-text-link">
          {t('contactShop')}
        </Link>
      </section>
    );
  return <AccountWorkspace key={user.id} user={user} />;
}
