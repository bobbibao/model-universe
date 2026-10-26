import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { BuybackAsset } from '../../../../../shared/types/buyback';
import type { PawnStatus, PawnTerms } from '../../../../../shared/types/pawn';
import type { PawnDisposalStatement } from '../../../../../shared/types/pawn-disposal';
import type { PawnEstimate } from '../../../../../shared/pawn-rules';
import type { ReferenceCondition } from '../../../../../shared/sale-pricing';

@Table({ tableName: 'pawn_contract', indexes: [{ unique: true, fields: ['userId', 'requestKey'] }, { fields: ['userId', 'createdAt'] }, { fields: ['status', 'dueAt'] }] })
export default class PawnContractModel extends Model {
  @Column({ type: DataType.INTEGER, allowNull: false }) userId!: number;
  @Column({ type: DataType.STRING, allowNull: false }) requestKey!: string;
  @Column({ type: DataType.STRING, allowNull: false }) requestDigest!: string;
  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'submitted' }) status!: PawnStatus;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) version!: number;
  @Column({ type: DataType.JSONB, allowNull: false }) asset!: BuybackAsset;
  @Column(DataType.JSONB) terms!: PawnTerms | null;
  @Column({ type: DataType.STRING, unique: true }) contractReference!: string | null;
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] }) contractEvidenceIds!: number[];
  @Column(DataType.DATE) custodyAt!: Date | null;
  @Column({ type: DataType.STRING, unique: true }) custodyReference!: string | null;
  @Column(DataType.DATE) disbursedAt!: Date | null;
  @Column(DataType.DATE) dueAt!: Date | null;
  @Column(DataType.DATE) paidAt!: Date | null;
  @Column(DataType.DATE) handbackAt!: Date | null;
  @Column(DataType.DATE) disposedAt!: Date | null;
  @Column(DataType.JSONB) disposalStatement!: PawnDisposalStatement | null;
  @Column(DataType.DATE) disposalSettledAt!: Date | null;
  @Column({ type: DataType.INTEGER, unique: true }) productId!: number | null;
  @Column(DataType.JSONB) extensionRequest!: { proposedDueAt: string; reason: string } | null;
  // The catalogue model the customer chose and the web quote C50 computed from its S (pawn-rules.ts, 2026-10-26).
  @Column(DataType.INTEGER) referenceProductId!: number | null;
  // The condition the customer chose for it: 'new' (C50 of S) or 'preowned' (C50 of S 2hand).
  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'new' }) referenceCondition!: ReferenceCondition;
  @Column(DataType.JSONB) webQuote!: PawnEstimate | null;
  public static async seedData(): Promise<void> {}
}
