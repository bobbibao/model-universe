import FinanceWorkspace, { type FinanceTab } from '@/core/client/features/finance/FinanceWorkspace';
import { privatePageMetadata } from '@/shared/seo';
export const metadata = privatePageMetadata('Chi phí & đối soát');
const tabs: FinanceTab[] = ['expenses', 'orders', 'payments'];
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const query = await searchParams;
  return <FinanceWorkspace initialTab={tabs.find((tab) => tab === query.tab) ?? 'expenses'} />;
}
