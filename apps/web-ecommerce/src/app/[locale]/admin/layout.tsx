import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import DefaultLayout from '@/components/Layouts/DefaultLayout';

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
