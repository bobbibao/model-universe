import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { BUILT_IN_CONDITIONS } from '../../../../../shared/product-conditions';

// A condition a unit can be sold in (src/shared/product-conditions.ts): the four built-in ones and those the owner adds
// in Admin. `product.condition` holds its `key`.
@Table({ tableName: 'product_condition_type' })
export default class ProductConditionTypeModel extends Model {
  @Column({ type: DataType.STRING(40), allowNull: false, unique: true }) key!: string;
  @Column({ type: DataType.STRING(80), allowNull: false }) nameVi!: string;
  @Column({ type: DataType.STRING(80), allowNull: false }) nameEn!: string;
  @Column(DataType.TEXT) descriptionVi!: string | null;
  @Column(DataType.TEXT) descriptionEn!: string | null;
  // Added to a listing's SKU for a unit in this condition (e.g. "-2H1").
  @Column({ type: DataType.STRING(8), allowNull: false }) skuSuffix!: string;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 100 }) sortOrder!: number;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true }) isActive!: boolean;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) isSystem!: boolean;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) uniqueUnit!: boolean;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) requiresMissingAccessories!: boolean;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) requiresDefects!: boolean;
  @Column(DataType.INTEGER) createdByUserId!: number | null;

  // The built-in conditions, added when missing; names, descriptions and order staff changed are kept.
  public static async seedData(): Promise<void> {
    for (const condition of BUILT_IN_CONDITIONS)
      await ProductConditionTypeModel.findOrCreate({ where: { key: condition.key }, defaults: { ...condition } });
  }
}
