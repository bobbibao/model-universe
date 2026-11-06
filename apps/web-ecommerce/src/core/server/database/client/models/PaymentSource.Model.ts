import { Column, DataType, Model, Table } from 'sequelize-typescript';

// The account that paid one provider-confirmed payment, exactly as the provider's signed data (webhook) or its
// authenticated status API reported it. Append-only: refunds to source are sent to these accounts only.
@Table({
  tableName: 'payment_source',
  indexes: [{ unique: true, fields: ['provider', 'reference'] }, { fields: ['linkId'] }],
})
export default class PaymentSourceModel extends Model {
  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'payos' }) provider!: 'payos';
  // order_payment_link.id (foreign key and append-only trigger: migration 2026-11-06-64).
  @Column({ type: DataType.INTEGER, allowNull: false }) linkId!: number;
  @Column({ type: DataType.STRING, allowNull: false }) reference!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) amountVnd!: number;
  @Column(DataType.STRING) bankBin!: string | null;
  @Column(DataType.STRING) bankName!: string | null;
  @Column(DataType.STRING) accountNumber!: string | null;
  @Column(DataType.STRING) accountName!: string | null;
  @Column({ type: DataType.STRING, allowNull: false }) verifiedBy!: 'payos_webhook' | 'payos_api';
  // Created by the payment gateway only; there is no seed data.
  static async seedData(): Promise<void> {}
}
