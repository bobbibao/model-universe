import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { ListingQcChecks } from '../../../../../shared/listing-qc';

// One pre-listing QC review of a bought-back unit (owner specification of 2026-10-25, §12-§13): the sixteen checks,
// the reviewer and time, and a digest of the listing it approved (photos, price, SKU, condition). A later change to any
// of those voids it (`invalidatedAt`) and the unit needs a new review before stock intake or publication.
@Table({ tableName: 'listing_qc_review', indexes: [{ fields: ['buybackRequestId', 'id'] }, { fields: ['productId'] }] })
export default class ListingQcReviewModel extends Model {
  @Column({ type: DataType.INTEGER, allowNull: false }) buybackRequestId!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) productId!: number;
  @Column({ type: DataType.JSONB, allowNull: false }) checks!: ListingQcChecks;
  @Column({ type: DataType.STRING(16), allowNull: false }) result!: 'passed' | 'failed';
  // Exceptions, evidence references and the reviewer's notes.
  @Column({ type: DataType.TEXT, allowNull: false }) notes!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) reviewerUserId!: number;
  @Column({ type: DataType.DATE, allowNull: false }) reviewedAt!: Date;
  @Column({ type: DataType.STRING(64), allowNull: false }) listingDigest!: string;
  @Column(DataType.DATE) invalidatedAt!: Date | null;
  @Column(DataType.TEXT) invalidatedReason!: string | null;

  public static async seedData(): Promise<void> {}
}
