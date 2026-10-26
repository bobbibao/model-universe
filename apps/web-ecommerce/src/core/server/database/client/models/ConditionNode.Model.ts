import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { ItemTypeKey } from '../../../../../shared/condition-tree';

@Table({ tableName: 'condition_node', indexes: [{ fields: ['parentId', 'sortOrder'] }] })
export default class ConditionNodeModel extends Model {
  @Column({ type: DataType.INTEGER, references: { model: 'condition_node', key: 'id' }, onDelete: 'RESTRICT' })
  parentId!: number | null;
  @Column({ type: DataType.STRING(100), allowNull: false, unique: true }) key!: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) nameVi!: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) nameEn!: string;
  @Column(DataType.TEXT) description!: string | null;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) selectable!: boolean;
  @Column({ type: DataType.STRING(12), allowNull: false, defaultValue: 'multiple' }) selectionMode!:
    'multiple' | 'single';
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: ['new', 'preowned'] }) itemTypes!: ItemTypeKey[];
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) sortOrder!: number;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true }) isActive!: boolean;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) version!: number;
  public static async seedData(): Promise<void> {}
}
