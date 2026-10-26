import StoreLayout from '@/components/Layouts/StoreLayout';
import BuybackWorkspace from '@/core/client/features/buyback/BuybackWorkspace';

export default function TradeModelsPage() {
  return (
    <StoreLayout>
      <BuybackWorkspace mode="trade" />
    </StoreLayout>
  );
}
