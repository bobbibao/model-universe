import CatalogIntakeModel from '../../database/client/models/CatalogIntake.Model';
import type { Transaction } from 'sequelize';
import OrderItemModel from '../../database/client/models/OrderItem.Model';
import StockImportItemModel from '../../database/client/models/StockImportItem.Model';
import ReservationModel from '../../database/client/models/Reservation.Model';
import LoyaltyGiftModel from '../../database/client/models/LoyaltyGift.Model';
import LoyaltyRedemptionModel from '../../database/client/models/LoyaltyRedemption.Model';
import ReturnEventModel from '../../database/client/models/ReturnEvent.Model';
import BuybackRequestModel from '../../database/client/models/BuybackRequest.Model';
import PawnContractModel from '../../database/client/models/PawnContract.Model';
import RestockSubscriptionModel from '../../database/client/models/RestockSubscription.Model';

// Whether retained records point at a product (orders, receipts, reservations, rewards, returns, buy-backs, pawns,
// stock alerts). Such a product is archived instead of deleted, so that history keeps pointing at it.
export const productHasHistory = async (productId: number, transaction?: Transaction): Promise<boolean> => {
  const where = { productId };
  const counts = [
    () => CatalogIntakeModel.count({ where, transaction }),
    () => OrderItemModel.count({ where, transaction }),
    () => StockImportItemModel.count({ where, transaction }),
    () => ReservationModel.count({ where, transaction }),
    () => LoyaltyGiftModel.count({ where, transaction }),
    () => LoyaltyRedemptionModel.count({ where: { giftProductId: productId }, transaction }),
    () => ReturnEventModel.count({ where, transaction }),
    () => BuybackRequestModel.count({ where, transaction }),
    () => PawnContractModel.count({ where, transaction }),
    () => RestockSubscriptionModel.count({ where, transaction }),
  ];
  for (const count of counts) if ((await count()) > 0) return true;
  return false;
};
