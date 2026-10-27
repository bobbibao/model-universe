import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'recommendation_event',
  indexes: [
    { name: 'recommendation_event_user_created_idx', fields: ['userId', 'createdAt'] },
    { name: 'recommendation_event_session_created_idx', fields: ['sessionKey', 'createdAt'] },
    { name: 'recommendation_event_product_type_idx', fields: ['productId', 'eventType', 'createdAt'] },
    { name: 'recommendation_event_type_created_idx', fields: ['eventType', 'createdAt'] },
  ],
})
export default class RecommendationEventModel extends Model {
  @Column(DataType.INTEGER)
  userId!: number | null;

  @Column({ type: DataType.STRING(64), allowNull: false })
  sessionKey!: string;

  @Column({ type: DataType.STRING(32), allowNull: false })
  eventType!: string;

  @Column(DataType.INTEGER)
  productId!: number | null;

  @Column(DataType.INTEGER)
  sourceProductId!: number | null;

  @Column(DataType.INTEGER)
  categoryId!: number | null;

  @Column(DataType.STRING(120))
  searchQuery!: string | null;

  @Column(DataType.STRING(32))
  strategy!: string | null;

  @Column(DataType.STRING(32))
  surface!: string | null;

  @Column(DataType.INTEGER)
  dwellMs!: number | null;

  @Column(DataType.INTEGER)
  priceVnd!: number | null;

  @Column(DataType.JSONB)
  metadata!: Record<string, unknown> | null;

  public static async seedData(): Promise<void> {}
}

