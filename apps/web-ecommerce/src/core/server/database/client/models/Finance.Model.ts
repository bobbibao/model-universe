import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { CostBasis, FinanceCategory, FinanceReview } from '../../../../../shared/finance';

@Table({ tableName: 'finance_cost_type' })
export class FinanceCostTypeModel extends Model {
  @Column({ type: DataType.STRING(100), allowNull: false, unique: true }) name!: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) category!: FinanceCategory;
  @Column({ type: DataType.STRING(20), allowNull: false }) basis!: CostBasis;
  @Column({ type: DataType.BIGINT, allowNull: false }) unitCostVnd!: number;
  @Column({ type: DataType.STRING(30), allowNull: false }) unit!: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true }) isActive!: boolean;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 }) version!: number;
  static async seedData(): Promise<void> {}
}

@Table({
  tableName: 'finance_expense',
  updatedAt: false,
  indexes: [{ fields: ['incurredAt'] }, { fields: ['orderId'] }],
})
export class FinanceExpenseModel extends Model {
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    references: { model: 'finance_cost_type', key: 'id' },
    onDelete: 'RESTRICT',
  })
  costTypeId!: number;
  @Column({ type: DataType.INTEGER, references: { model: 'order', key: 'id' }, onDelete: 'RESTRICT' }) orderId!:
    number | null;
  @Column({
    type: DataType.INTEGER,
    references: { model: 'finance_expense', key: 'id' },
    unique: true,
    onDelete: 'RESTRICT',
  })
  reversesId!: number | null;
  @Column({ type: DataType.STRING(100), allowNull: false, unique: true }) requestKey!: string;
  @Column({ type: DataType.STRING(64), allowNull: false }) requestDigest!: string;
  @Column({ type: DataType.DATE, allowNull: false }) incurredAt!: Date;
  @Column({ type: DataType.STRING(100), allowNull: false }) nameSnapshot!: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) categorySnapshot!: FinanceCategory;
  @Column({ type: DataType.STRING(20), allowNull: false }) basisSnapshot!: CostBasis;
  @Column({ type: DataType.INTEGER, allowNull: false }) typeVersion!: number;
  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: '' }) unitSnapshot!: string;
  @Column({ type: DataType.DECIMAL(14, 3), allowNull: false }) quantity!: number;
  @Column({ type: DataType.BIGINT, allowNull: false }) unitCostVnd!: number;
  @Column({ type: DataType.BIGINT, allowNull: false }) amountVnd!: number;
  @Column({ type: DataType.TEXT, allowNull: false }) note!: string;
  @Column({ type: DataType.INTEGER, allowNull: false, references: { model: 'user', key: 'id' }, onDelete: 'RESTRICT' })
  actorUserId!: number;
  static async seedData(): Promise<void> {}
}

@Table({
  tableName: 'finance_order_review',
  updatedAt: false,
  indexes: [{ unique: true, fields: ['orderId', 'version'] }],
})
export class FinanceOrderReviewModel extends Model {
  @Column({ type: DataType.INTEGER, allowNull: false, references: { model: 'order', key: 'id' }, onDelete: 'RESTRICT' })
  orderId!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) version!: number;
  @Column({ type: DataType.JSONB, allowNull: false }) items!: FinanceReview['items'];
  @Column({ type: DataType.BOOLEAN, allowNull: false }) costsReviewed!: boolean;
  @Column({ type: DataType.TEXT, allowNull: false }) note!: string;
  @Column({ type: DataType.INTEGER, allowNull: false, references: { model: 'user', key: 'id' }, onDelete: 'RESTRICT' })
  actorUserId!: number;
  static async seedData(): Promise<void> {}
}

@Table({ tableName: 'finance_config_audit', updatedAt: false })
export class FinanceConfigAuditModel extends Model {
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    references: { model: 'finance_cost_type', key: 'id' },
    onDelete: 'RESTRICT',
  })
  costTypeId!: number;
  @Column({ type: DataType.JSONB, allowNull: false }) snapshot!: Record<string, unknown>;
  @Column({ type: DataType.INTEGER, allowNull: false, references: { model: 'user', key: 'id' }, onDelete: 'RESTRICT' })
  actorUserId!: number;
  static async seedData(): Promise<void> {}
}
