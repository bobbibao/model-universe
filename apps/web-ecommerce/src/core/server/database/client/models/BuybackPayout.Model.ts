import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'buyback_payout' })
export default class BuybackPayoutModel extends Model {
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true }) buybackRequestId!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) actorUserId!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) amountVnd!: number;
  @Column({ type: DataType.STRING, allowNull: false, unique: true }) externalReference!: string;
  @Column({ type: DataType.TEXT, allowNull: false }) reason!: string;
  // Who paid whom: the shop pays the buy-back (or a trade's negative difference); in a trade with a positive difference
  // the customer pays the shop.
  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'shop_pays' })
  direction!: 'shop_pays' | 'customer_pays';
  public static async seedData(): Promise<void> {}
}
