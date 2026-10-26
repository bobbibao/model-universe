import { Column, DataType, Model, Table } from 'sequelize-typescript';

// One verified stock mutation per source. Many sources may point to the same condition SKU.
@Table({
  tableName: 'catalog_intake',
  indexes: [{ unique: true, fields: ['sourceType', 'sourceId'] }, { fields: ['productId'] }],
})
export default class CatalogIntakeModel extends Model {
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    references: { model: 'product', key: 'id' },
    onDelete: 'RESTRICT',
  })
  productId!: number;
  @Column({ type: DataType.STRING(30), allowNull: false }) sourceType!: string;
  @Column({ type: DataType.STRING(100), allowNull: false }) sourceId!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) quantity!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) unitCostVnd!: number;
  @Column(DataType.INTEGER) actorUserId!: number | null;
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} }) snapshot!: Record<string, unknown>;
  public static async seedData(): Promise<void> {}
}
