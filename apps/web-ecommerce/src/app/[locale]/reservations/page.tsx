import StoreLayout from '@/components/Layouts/StoreLayout';
import ReservationWorkspace from '@/core/client/features/reservations/ReservationWorkspace';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Giữ hàng của tôi');

export default function ReservationsPage() {
  return <StoreLayout><ReservationWorkspace /></StoreLayout>;
}
