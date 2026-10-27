import FinanceWorkspace from '@/core/client/features/finance/FinanceWorkspace';
export const metadata = { title: 'Chi phí & đối soát - Model Universe' };
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const query = await searchParams;
  return <FinanceWorkspace initialTab={query.tab === 'orders' ? 'orders' : 'expenses'} />;
}
