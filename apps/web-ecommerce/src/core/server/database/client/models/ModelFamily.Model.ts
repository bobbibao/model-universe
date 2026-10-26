import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'model_family' })
export default class ModelFamilyModel extends Model {
  @Column({ type: DataType.STRING(64), allowNull: false, unique: true }) identityKey!: string;
  @Column({ type: DataType.STRING, allowNull: false }) name!: string;
  @Column({ type: DataType.STRING, allowNull: false }) brandName!: string;
  @Column(DataType.STRING) modelCode!: string | null;
  @Column(DataType.STRING) scale!: string | null;
  @Column(DataType.INTEGER) partnerId!: number | null;
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} }) identity!: Record<string, unknown>;
  public static async seedData(): Promise<void> {}
}
