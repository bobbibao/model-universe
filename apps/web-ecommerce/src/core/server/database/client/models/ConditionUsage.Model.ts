import { Column, DataType, Model, Table } from 'sequelize-typescript';

// Append-only references prevent deleting a condition that disappeared from a later product/request revision.
@Table({
  tableName: 'condition_usage',
  updatedAt: false,
  indexes: [{ unique: true, fields: ['nodeId', 'entityType', 'entityId'] }],
})
export default class ConditionUsageModel extends Model {
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    references: { model: 'condition_node', key: 'id' },
    onDelete: 'RESTRICT',
  })
  nodeId!: number;
  @Column({ type: DataType.STRING(20), allowNull: false }) entityType!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) entityId!: number;
  public static async seedData(): Promise<void> {}
}
