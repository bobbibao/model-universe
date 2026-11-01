import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import DefaultLayout from '@/components/Layouts/DefaultLayout';
import '@/css/admin-workspace.css';
import '@/css/finance-workspace.css';
import '@/css/compact-workspaces.css';
import '@/css/product-forms.css';
import '@/css/direct-sales.css';
import '@/css/condition-tree.css';

// Keep the navigation mounted across admin routes (scroll position, dropdowns and header).
// Admin portal is strictly Vietnamese-only.
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== 'vi') {
    redirect('/vi/admin/dashboard');
  }
  return <DefaultLayout>{children}</DefaultLayout>;
}
