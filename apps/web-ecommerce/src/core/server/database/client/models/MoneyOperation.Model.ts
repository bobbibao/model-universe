import type { MoneyOperation } from '../../../../../shared/types/money-operation';
import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'money_operation',
  indexes: [{ unique: true, fields: ['requestKey'] }, { fields: ['purpose', 'entityId', 'status'] }],
})
export default class MoneyOperationModel extends Model {
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) version!: number;
  @Column({ type: DataType.STRING, allowNull: false }) purpose!:
    'hold_refund' | 'pawn_credit_refund' | 'purchase_refund' | 'pawn_disposal_surplus';
  @Column({ type: DataType.INTEGER, allowNull: false }) entityId!: number;
  @Column({ type: DataType.BIGINT, allowNull: false }) amountVnd!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) requestedBy!: number;
  @Column(DataType.INTEGER) approvedBy!: number | null;
  @Column({ type: DataType.STRING, allowNull: false }) requestKey!: string;
  @Column({ type: DataType.STRING, allowNull: false }) requestDigest!: string;
  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'requested' }) status!:
    'requested' | 'approved' | 'completed' | 'rejected' | 'reconciliation';
  @Column({ type: DataType.JSONB, allowNull: false }) details!: MoneyOperation['details'];
  @Column({ type: DataType.STRING, unique: true }) providerReference!: string | null;
  @Column({ type: DataType.STRING, unique: true }) providerEventKey!: string | null;
  @Column(DataType.DATE) completedAt!: Date | null;
  static async seedData(): Promise<void> {}
}
