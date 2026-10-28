import type { PawnGovernance } from '../../../shared/types/pawn';
import CommerceAccessService from './CommerceAccessService';
import PawnReminderService from './PawnReminderService';
import MoneyOperationModel from '../database/client/models/MoneyOperation.Model';
import CatalogTreeService from './catalog/CatalogTreeService';
import NotificationDispatchService from './NotificationDispatchService';
import crypto from 'crypto';
import { isReferenceCondition } from '../../../shared/sale-pricing';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import PawnContractModel from '../database/client/models/PawnContract.Model';
import PawnEventModel from '../database/client/models/PawnEvent.Model';
import PawnPaymentModel from '../database/client/models/PawnPayment.Model';
import EvidenceModel from '../database/client/models/Evidence.Model';
import ProductModel from '../database/client/models/Product.Model';
import UserModel from '../database/internal/models/User.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import { ASSEMBLY_STATES } from '../../../shared/gunpla';
import type { BuybackAsset } from '../../../shared/types/buyback';
import type { PawnTerms } from '../../../shared/types/pawn';
import {
  estimatePawn,
  PAWN_DAY_MS,
  pawnInterest,
  pawnCashFlowEstimate,
  pawnExtensionQuote,
  simulatePawnOwed,
  validatePawnPolicy,
  validatePawnPrincipal,
} from '../../../shared/pawn-rules';
import EvidenceService from './EvidenceService';
import CommercePolicyService from './CommercePolicyService';
import MoneyReferenceService from './MoneyReferenceService';
import { activateOwnedCollectibleDraft } from './CollectibleIntakeService';
import CommerceNotificationModel from '../database/client/models/CommerceNotification.Model';
import PawnDisposalService from './PawnDisposalService';

const text = (value: unknown, label: string, max = 1500) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw HttpError.badRequest(`Provide ${label}, at most ${max} characters.`);
  return value.trim();
};
const reference = (value: unknown) => {
  const result = text(value, 'actual transaction reference', 128).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9:/._-]{7,127}$/.test(result))
    throw HttpError.badRequest('Use an actual 8–128 character transaction reference.');
  return result;
};
const amount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 4294967294)
    throw HttpError.badRequest('Provide a positive whole VND amount.');
  return value;
};

export default class PawnService {
  private evidence = new EvidenceService();
  private policy = new CommercePolicyService();
  private async actor(userId: number, admin: boolean, transaction?: Transaction) {
    const user = await UserModel.findByPk(userId, { transaction });
    if (!user?.isActive || (admin && user.role !== 'ADMIN')) throw HttpError.forbidden();
  }
  private async locked(id: number, userId: number, admin: boolean, transaction: Transaction) {
    if (!Number.isSafeInteger(id) || id < 1) throw HttpError.badRequest('Invalid pawn request ID.');
    await this.actor(userId, admin, transaction);
    const row = await PawnContractModel.findOne({
      where: { id, ...(admin ? {} : { userId }) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw HttpError.notFound('Pawn request not found.');
    return row;
  }
  private current(row: PawnContractModel, expected: unknown) {
    if (!Number.isSafeInteger(expected) || expected !== row.version)
      throw HttpError.conflict('Review the latest contract version before deciding.');
  }
  private async event(
    row: PawnContractModel,
    actorUserId: number,
    action: string,
    details: Record<string, unknown>,
    transaction: Transaction,
  ) {
    await PawnEventModel.create(
      { pawnContractId: row.id, actorUserId, action, details: { version: row.version, ...details } },
      { transaction },
    );
  }
  private async estimate(row: PawnContractModel, asOf = new Date(), transaction?: Transaction) {
    const collectedVnd = Number(
      (await PawnPaymentModel.sum('amountVnd', {
        where: { pawnContractId: row.id, kind: 'redemption' },
        transaction,
      })) || 0,
    );
    if (!row.terms || !row.disbursedAt)
      return { asOf, days: 0, interestVnd: 0, capped: false, collectedVnd, remainingVnd: 0 };
    if (row.status === 'disposed') {
      const summary = await new PawnDisposalService().summary(row);
      if (summary)
        return {
          asOf,
          ...pawnInterest(row.terms.principalVnd, row.terms.policy, row.disbursedAt, row.disposalSettledAt || asOf),
          collectedVnd: summary.proceedsVnd - summary.costsVnd + summary.repaymentsVnd - summary.surplusPaidVnd,
          remainingVnd: summary.remainingVnd,
          reconciliationRequired: summary.reconciliationRequired,
        };
    }
    const stop =
      row.handbackAt || (row.terms.policy.interestStopEvent === 'verified_repayment' ? row.paidAt : null) || asOf;
    if (row.terms.policy.calculation === 'compound_0_3_v2') {
      const flows = await PawnPaymentModel.findAll({
        where: { pawnContractId: row.id },
        order: [['id', 'ASC']],
        transaction,
      });
      return {
        asOf,
        ...pawnCashFlowEstimate(
          row.terms.principalVnd,
          row.terms.policy,
          row.disbursedAt,
          asOf,
          flows.map((flow) => flow.get({ plain: true })),
          row.paidAt || row.handbackAt || undefined,
        ),
      };
    }
    const interest = pawnInterest(row.terms.principalVnd, row.terms.policy, row.disbursedAt, stop);
    return {
      asOf,
      ...interest,
      collectedVnd,
      remainingVnd: Math.max(0, row.terms.principalVnd + interest.interestVnd - collectedVnd),
    };
  }
  async list(userId: number, admin = false) {
    await this.actor(userId, admin);
    const rows = await PawnContractModel.findAll({
      where: admin ? {} : { userId },
      attributes: { exclude: ['requestKey', 'requestDigest'] },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: 100,
    });
    return rows.map((row) => ({
      ...row.get({ plain: true }),
      overdue: ['active', 'DUE_GRACE', 'OVERDUE_REVIEW'].includes(row.status) && !!row.dueAt && row.dueAt < new Date(),
    }));
  }
  async detail(id: number, userId: number, admin = false) {
    if (!Number.isSafeInteger(id) || id < 1) throw HttpError.badRequest('Invalid pawn request ID.');
    await this.actor(userId, admin);
    const row = await PawnContractModel.findOne({
      where: { id, ...(admin ? {} : { userId }) },
      attributes: { exclude: ['requestKey', 'requestDigest'] },
    });
    if (!row) throw HttpError.notFound('Pawn request not found.');
    const [events, evidence, payments, estimate] = await Promise.all([
      PawnEventModel.findAll({ where: { pawnContractId: id }, order: [['id', 'ASC']] }),
      this.evidence.list(row.userId, 'pawn', id),
      PawnPaymentModel.findAll({ where: { pawnContractId: id }, order: [['id', 'ASC']] }),
      this.estimate(row),
    ]);
    return {
      ...row.get({ plain: true }),
      simulation: row.terms
        ? {
            legalMode: row.terms.policy.legalMode || 'simulation',
            rateDailyBps: 30,
            principalVnd: row.terms.principalVnd,
            days: row.terms.termDays,
            owedVnd: simulatePawnOwed(row.terms.principalVnd, row.terms.termDays),
            interestVnd: simulatePawnOwed(row.terms.principalVnd, row.terms.termDays) - row.terms.principalVnd,
          }
        : null,
      operations: await MoneyOperationModel.findAll({
        where: { purpose: 'pawn_credit_refund', entityId: id },
        order: [['id', 'DESC']],
      }),
      overdue: ['active', 'DUE_GRACE', 'OVERDUE_REVIEW'].includes(row.status) && !!row.dueAt && row.dueAt < new Date(),
      events,
      evidence,
      estimate,
      disposal: await new PawnDisposalService().summary(row),
      payments: payments.map((payment) => ({
        ...payment.get({ plain: true }),
        amountVnd: Number(payment.amountVnd),
        principalVnd: Number(payment.principalVnd),
        interestVnd: Number(payment.interestVnd),
      })),
    };
  }
  async notifications(userId: number) {
    await this.actor(userId, false);
    return CommerceNotificationModel.findAll({
      where: { userId, kind: ['pawn_due', 'pawn_overdue'], cancelledAt: null, availableAt: { [Op.lte]: new Date() } },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
  }
  async create(userId: number, data: Record<string, unknown>) {
    const requestKey = text(data.requestKey, 'request key', 128);
    if (!data.asset || typeof data.asset !== 'object' || Array.isArray(data.asset))
      throw HttpError.badRequest('Describe the actual model and condition.');
    const input = data.asset as Record<string, unknown>,
      asset = {} as BuybackAsset;
    for (const key of [
      'name',
      'modelCode',
      'version',
      'assemblyState',
      'boxCondition',
      'accessories',
      'defects',
      'repairHistory',
    ] as const)
      asset[key] = text(input[key], key, key === 'name' ? 255 : 1500);
    if (!ASSEMBLY_STATES.includes(asset.assemblyState as (typeof ASSEMBLY_STATES)[number]))
      throw HttpError.badRequest('Invalid assembly state.');
    if (!Array.isArray(data.evidenceIds) || data.evidenceIds.length < 3)
      throw HttpError.badRequest('Provide at least three distinct actual-item photographs.');
    // The catalogue model for the web quote C50 (only a model the shop sells new, declared without issues).
    const referenceProductId = data.referenceProductId == null ? null : Number(data.referenceProductId);
    if (referenceProductId !== null && (!Number.isSafeInteger(referenceProductId) || referenceProductId < 1))
      throw HttpError.badRequest('Choose a catalogue model or leave it empty.');
    const issuesDeclared = data.issuesDeclared === true;
    // The condition the customer chose: new (C50 of S) or 2hand (C50 of S 2hand).
    const referenceCondition = data.referenceCondition == null ? 'new' : data.referenceCondition;
    if (!isReferenceCondition(referenceCondition)) throw HttpError.badRequest('Choose new or 2hand.');
    const requestDigest = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          asset,
          modelFamilyId: data.modelFamilyId,
          itemTypeKey: data.itemTypeKey,
          conditionNodeIds: data.conditionNodeIds,
          otherCondition: data.otherCondition,
          evidenceIds: data.evidenceIds,
          ...(referenceProductId
            ? { referenceProductId, issuesDeclared, ...(referenceCondition === 'new' ? {} : { referenceCondition }) }
            : {}),
        }),
      )
      .digest('hex');
    const id = await DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.actor(userId, false, transaction);
      await DatabaseProvider.getInstance().query('SELECT pg_advisory_xact_lock(836211, hashtext(:key))', {
        replacements: { key: `${userId}:${requestKey}` },
        transaction,
      });
      const replay = await PawnContractModel.findOne({ where: { userId, requestKey }, transaction });
      if (replay) {
        if (replay.requestDigest !== requestDigest)
          throw HttpError.conflict('The request key belongs to another model or evidence set.');
        return replay.id;
      }
      const product = referenceProductId
        ? await ProductModel.findOne({ where: { id: referenceProductId, partnerId: null }, transaction })
        : null;
      if (referenceProductId && !product) throw HttpError.notFound('Catalogue model not found.');
      const conditionCase = await new CatalogTreeService().snapshot(data, transaction);
      const webQuote = estimatePawn(conditionCase.salePriceVnd, {
        approved: !!conditionCase.approvedAt,
        issuesDeclared: false,
      });
      const row = await PawnContractModel.create(
        {
          userId,
          requestKey,
          requestDigest,
          asset,
          referenceProductId: conditionCase.productId,
          referenceCondition: conditionCase.itemTypeKey,
          conditionCase,
          conditionCaseStatus: conditionCase.salePriceVnd !== null ? 'resolved' : 'pending',
          webQuote,
        },
        { transaction },
      );
      if (conditionCase.salePriceVnd === null)
        await new NotificationDispatchService().alertAdmins(
          {
            kind: 'service_condition_proposal',
            orderId: null,
            dedupeKey: `pawn:${row.id}:condition:submitted`,
            title: 'Đề xuất tình trạng cầm mới',
            content: `Yêu cầu #${row.id}: ${asset.name}. ${conditionCase.labels.join('; ')}. ${conditionCase.otherCondition}. Xem /admin/pawn`,
          },
          transaction,
        );
      await new CatalogTreeService().remember(conditionCase.conditionNodeIds, 'pawn', row.id, transaction);
      const evidence = await this.evidence.bind(data.evidenceIds, userId, 'pawn', row.id, transaction);
      if (new Set(evidence.map((file) => file.sha256)).size < 3)
        throw HttpError.badRequest('Provide three distinct model views.');
      await this.event(row, userId, 'submitted', { asset, conditionCase, webQuote }, transaction);
      return row.id;
    });
    return this.detail(id, userId);
  }
  async act(id: number, userId: number, data: Record<string, unknown>, admin = false) {
    const action = text(data.action, 'action', 40);
    const staffActions = [
      'quote',
      'confirm_contract',
      'receive_asset',
      'extension_decision',
      'handback',
      'dispose',
      'verify_documents',
      'record_notice',
      'compliance_disposal',
      'finance_disposal',
      'title_transfer',
      'mark_dispute',
      'resolve_dispute',
    ];
    if (staffActions.includes(action) !== admin) throw HttpError.forbidden();
    await DatabaseProvider.getInstance()
      .transaction(async (transaction) => {
        const row = await this.locked(id, userId, admin, transaction);
        this.current(row, data.expectedVersion);
        if (['quote', 'accept'].includes(action) && row.conditionCase && row.conditionCaseStatus !== 'resolved')
          throw HttpError.conflict('Duyệt tổ hợp và giá S trước khi báo giá.', 'CONDITION_CASE_PENDING');
        const details: Record<string, unknown> = {};
        if (row.governance.disputed && !['raise_dispute', 'mark_dispute', 'resolve_dispute', 'cancel'].includes(action))
          throw HttpError.conflict('Resolve the ownership/legal dispute first.');
        switch (action) {
          case 'quote': {
            if (
              row.disbursedAt ||
              !['submitted', 'quoted', 'accepted', 'contract_confirmed', 'in_custody'].includes(row.status)
            )
              throw HttpError.conflict('Disbursed contract terms cannot be changed.');
            const approved = await this.policy.approved('pawn', transaction);
            if (approved.settings.calculation !== 'compound_0_3_v2') throw HttpError.policyApprovalRequired('pawn');
            let policy;
            try {
              policy = validatePawnPolicy(approved.settings);
              validatePawnPrincipal(Number(data.appraisalVnd), Number(data.principalVnd));
            } catch (error) {
              throw HttpError.badRequest((error as Error).message);
            }
            if (
              typeof data.appraisalVnd !== 'number' ||
              typeof data.principalVnd !== 'number' ||
              !Number.isInteger(data.termDays) ||
              Number(data.termDays) < 1 ||
              Number(data.termDays) > 365 ||
              typeof data.disposalAfterGrace !== 'boolean'
            )
              throw HttpError.badRequest('Choose explicit appraisal, principal, term and disposal terms.');
            if (!row.conditionCase?.approvedAt || !row.conditionCase.salePriceVnd)
              throw HttpError.conflict('Duyệt S của đúng SKU/tổ hợp trước khi báo giá cầm.');
            const terms: PawnTerms = {
              conditionCase: row.conditionCase,
              appraisalVnd: data.appraisalVnd,
              principalVnd: data.principalVnd,
              termDays: Number(data.termDays),
              contractText: text(data.details, 'full contract, extension and disposal conditions', 5000),
              disposalAfterGrace: data.disposalAfterGrace,
              policyVersion: approved.version,
              policy,
            };
            await row.update(
              { terms, status: 'quoted', contractReference: null, contractEvidenceIds: [] },
              { transaction },
            );
            details.terms = terms;
            break;
          }
          case 'accept': {
            if (
              row.status !== 'quoted' ||
              !row.terms ||
              data.termsAccepted !== true ||
              data.disposalTermsAccepted !== row.terms.disposalAfterGrace
            )
              throw HttpError.conflict('Accept the exact current interest, term and disposal agreement.');
            await row.update({ status: 'accepted' }, { transaction });
            details.acceptedTerms = row.terms;
            break;
          }
          case 'attach_contract': {
            if (row.status !== 'accepted' || row.contractEvidenceIds.length)
              throw HttpError.conflict('Upload the signed current agreement after accepting its terms.');
            const prior = await EvidenceModel.findAll({
              where: { ownerUserId: userId, purpose: 'pawn', entityId: id },
              transaction,
            });
            if (
              !Array.isArray(data.evidenceIds) ||
              data.evidenceIds.some((fileId) => prior.some((file) => file.id === fileId))
            )
              throw HttpError.badRequest('Upload separate scans of the signed current contract.');
            const files = await this.evidence.bind(data.evidenceIds, userId, 'pawn', id, transaction);
            const contractEvidenceIds = files.map((file) => file.id);
            await row.update({ contractEvidenceIds }, { transaction });
            details.contractEvidenceIds = contractEvidenceIds;
            break;
          }
          case 'confirm_contract': {
            if (
              row.status !== 'accepted' ||
              !row.contractEvidenceIds.length ||
              data.bilateralSignatureVerified !== true
            )
              throw HttpError.conflict('Verify both signatures on the uploaded current agreement first.');
            const contractReference = text(data.contractReference, 'signed contract reference', 255);
            await row.update(
              { status: row.custodyAt ? 'in_custody' : 'contract_confirmed', contractReference },
              { transaction },
            );
            Object.assign(details, {
              contractReference,
              terms: row.terms,
              contractEvidenceIds: row.contractEvidenceIds,
            });
            break;
          }
          case 'receive_asset': {
            if (!row.governance.identityVerified || !row.governance.ownershipVerified)
              throw HttpError.conflict('Verify identity, ownership and supporting papers first.');
            if (
              row.status !== 'contract_confirmed' ||
              data.handoverVerified !== true ||
              data.conditionMatchesAgreement !== true
            )
              throw HttpError.conflict(
                'Verify physical custody and condition against the signed agreement. Revise mismatched terms before disbursement.',
              );
            const custodyReference = text(data.custodyReference, 'actual asset custody tag / receipt reference', 255);
            if (await PawnContractModel.findOne({ where: { custodyReference }, transaction }))
              throw HttpError.conflict('This custody reference already belongs to a pledged asset.');
            await row.update({ status: 'in_custody', custodyAt: new Date(), custodyReference }, { transaction });
            details.inspection = text(data.details, 'actual handover and condition inspection');
            details.custodyReference = custodyReference;
            break;
          }
          case 'request_extension': {
            if (
              !['active', 'DUE_GRACE'].includes(row.status) ||
              !row.dueAt ||
              row.extensionRequest ||
              row.terms?.policy.calculation !== 'compound_0_3_v2' ||
              !row.disbursedAt
            )
              throw HttpError.conflict('An active contract can have one pending extension request.');
            const due = new Date(text(data.proposedDueAt, 'proposed due date', 50));
            if (
              !Number.isFinite(due.getTime()) ||
              due <= row.dueAt ||
              due <= new Date() ||
              due.getTime() > row.dueAt.getTime() + 365 * PAWN_DAY_MS
            )
              throw HttpError.badRequest('Request a later due date, at most one additional year.');
            const flows = await PawnPaymentModel.findAll({
              where: { pawnContractId: id },
              transaction,
              order: [['id', 'ASC']],
            });
            const projection = pawnExtensionQuote(
              row.terms.principalVnd,
              row.terms.appraisalVnd,
              row.terms.policy,
              row.disbursedAt,
              row.dueAt,
              due,
              flows.map((flow) => flow.get({ plain: true })),
            );
            if (!projection.eligible)
              throw HttpError.conflict('P outstanding + projected interest exceeds 80% of V before any credit.');
            const extensionRequest = {
              id: crypto.randomUUID(),
              oldDueAt: row.dueAt.toISOString(),
              proposedDueAt: due.toISOString(),
              reason: text(data.details, 'extension reason'),
              ...projection,
            };
            await row.update({ extensionRequest }, { transaction });
            details.extensionRequest = extensionRequest;
            break;
          }
          case 'extension_decision': {
            await CommerceAccessService.require(userId, 'finance', transaction);
            if (
              !['active', 'DUE_GRACE', 'OVERDUE_REVIEW'].includes(row.status) ||
              !row.extensionRequest ||
              !row.terms ||
              !row.disbursedAt ||
              !row.dueAt ||
              typeof data.accepted !== 'boolean'
            )
              throw HttpError.conflict('Review the current extension request.');
            const oldDueAt = row.dueAt;
            if (data.accepted) {
              if (row.status === 'OVERDUE_REVIEW' || new Date(row.extensionRequest.proposedDueAt) <= new Date())
                throw HttpError.conflict(
                  'Overdue review cannot auto-renew; resolve the pending extension and its credit explicitly.',
                );

              const flows = await PawnPaymentModel.findAll({
                where: { pawnContractId: id },
                transaction,
                order: [['id', 'ASC']],
              });
              const quote = pawnExtensionQuote(
                row.terms.principalVnd,
                row.terms.appraisalVnd,
                row.terms.policy,
                row.disbursedAt,
                row.dueAt,
                new Date(row.extensionRequest.proposedDueAt),
                flows.map((flow) => flow.get({ plain: true })),
              );
              const credit = flows
                .filter(
                  (flow) =>
                    flow.kind === 'extension_credit' && flow.metadata.extensionRequestId === row.extensionRequest!.id,
                )
                .reduce((sum, flow) => sum + Number(flow.amountVnd), 0);
              if (!quote.eligible || credit < quote.creditDueVnd)
                throw HttpError.conflict('Verify the extension prepayment and the 80% cap before approving.');
              await PawnReminderService.cancel(id, oldDueAt, transaction);
              await row.update(
                { dueAt: new Date(row.extensionRequest.proposedDueAt), status: 'active' },
                { transaction },
              );
              await PawnReminderService.schedule(row, transaction);
              Object.assign(details, { quote, creditVerifiedVnd: credit });
            }
            Object.assign(details, {
              oldDueAt,
              request: row.extensionRequest,
              accepted: data.accepted,
              reason: text(data.details, 'extension decision'),
            });
            await row.update({ extensionRequest: null }, { transaction });
            break;
          }
          case 'handback': {
            const refundableCustody =
              !row.disbursedAt && ['quoted', 'accepted', 'contract_confirmed', 'in_custody'].includes(row.status);
            if (data.handoverVerified !== true || !row.custodyAt || !(row.status === 'repaid' || refundableCustody))
              throw HttpError.conflict('Verify the actual asset handback after repayment or before disbursement.');
            const estimate = await this.estimate(row, new Date(), transaction);
            if (row.disbursedAt && estimate.remainingVnd !== 0)
              throw HttpError.conflict(
                'Additional accrued interest must be reconciled under the accepted stop-event policy before handback.',
              );
            details.reason = text(data.details, 'actual asset handback record');
            details.settlement = estimate;
            await row.update(
              { status: row.disbursedAt ? 'returned' : 'cancelled', handbackAt: new Date() },
              { transaction },
            );
            break;
          }
          case 'verify_documents': {
            if (row.disbursedAt || data.identityVerified !== true || data.ownershipVerified !== true)
              throw HttpError.conflict('Verify the customer identity and ownership before disbursement.');
            const files = await this.evidence.bind(data.evidenceIds, userId, 'pawn', id, transaction);
            if (!files.length) throw HttpError.badRequest('Upload supporting evidence for this verification.');
            const reference = text(data.details, 'identity and ownership verification reference');
            await row.update(
              {
                governance: {
                  ...row.governance,
                  identityVerified: true,
                  ownershipVerified: true,
                  documents: {
                    by: userId,
                    at: new Date().toISOString(),
                    evidenceIds: files.map((file) => file.id),
                    reference,
                  },
                },
              },
              { transaction },
            );
            details.documentReference = reference;
            break;
          }
          case 'raise_dispute':
          case 'mark_dispute': {
            const reason = text(data.details, 'ownership or payment dispute');
            const governance: PawnGovernance = {
              ...row.governance,
              disputed: true,
              dispute: { by: userId, at: new Date().toISOString(), reason },
            };
            delete governance.complianceApproval;
            delete governance.financeApproval;
            delete governance.titleTransfer;
            await row.update({ governance }, { transaction });
            if (row.productId)
              await ProductModel.update(
                { inventoryStatus: 'quarantine', listingStatus: 'hidden' },
                { where: { id: row.productId }, transaction },
              );
            details.dispute = governance.dispute;
            break;
          }
          case 'resolve_dispute': {
            await CommerceAccessService.require(userId, 'compliance', transaction);
            const reference = text(data.details, 'binding dispute resolution and ownership reference');
            const files = await this.evidence.bind(data.evidenceIds, userId, 'pawn', id, transaction);
            if (!files.length) throw HttpError.badRequest('Upload supporting evidence for this verification.');
            await row.update(
              {
                governance: {
                  ...row.governance,
                  disputed: false,
                  resolution: {
                    reference,
                    evidenceIds: files.map((file) => file.id),
                    by: userId,
                    at: new Date().toISOString(),
                  },
                },
              },
              { transaction },
            );
            details.resolution = reference;
            break;
          }
          case 'record_notice': {
            await CommerceAccessService.require(userId, 'compliance', transaction);
            if (row.status !== 'OVERDUE_REVIEW')
              throw HttpError.conflict('Notices require overdue review, not automatic enforcement.');
            const servedAt = new Date(text(data.servedAt, 'actual valid notice date', 50)),
              eligibleAt = new Date(text(data.eligibleAt, 'earliest lawful action date', 50));
            if (
              !Number.isFinite(servedAt.getTime()) ||
              servedAt > new Date() ||
              !Number.isFinite(eligibleAt.getTime()) ||
              eligibleAt < servedAt ||
              data.noticeValidityVerified !== true
            )
              throw HttpError.badRequest('Verify actual service and the applicable notice period.');
            const files = await this.evidence.bind(data.evidenceIds, userId, 'pawn', id, transaction);
            if (!files.length) throw HttpError.badRequest('Upload supporting evidence for this verification.');
            await row.update(
              {
                governance: {
                  ...row.governance,
                  notice: {
                    servedAt: servedAt.toISOString(),
                    eligibleAt: eligibleAt.toISOString(),
                    reference: text(data.details, 'notice legal basis and delivery proof'),
                    by: userId,
                    dueAt: row.dueAt?.toISOString(),
                    evidenceIds: files.map((file) => file.id),
                  },
                  complianceApproval: null,
                  financeApproval: null,
                },
              },
              { transaction },
            );
            details.notice = row.governance.notice;
            break;
          }
          case 'compliance_disposal':
          case 'finance_disposal': {
            const scope = action === 'compliance_disposal' ? 'compliance' : 'finance';
            await CommerceAccessService.require(userId, scope, transaction);
            if (
              row.status !== 'OVERDUE_REVIEW' ||
              !row.governance.notice ||
              row.governance.notice.dueAt !== row.dueAt?.toISOString() ||
              new Date(row.governance.notice.eligibleAt) > new Date()
            )
              throw HttpError.conflict('Complete valid notice and its waiting period first.');
            if (
              scope === 'finance' &&
              (!row.governance.complianceApproval || row.governance.complianceApproval.by === userId)
            )
              throw HttpError.forbidden('Finance and Compliance must be independent reviewers.');
            const reference = text(data.details, 'review decision and legal/accounting basis');
            const approval = {
              by: userId,
              reference,
              at: new Date().toISOString(),
              settlement: await this.estimate(row, new Date(), transaction),
            };
            await row.update(
              {
                governance: {
                  ...row.governance,
                  [scope === 'finance' ? 'financeApproval' : 'complianceApproval']: approval,
                  ...(scope === 'compliance' ? { financeApproval: null } : {}),
                },
              },
              { transaction },
            );
            details.approval = approval;
            break;
          }
          case 'dispose': {
            const now = new Date(),
              g = row.governance;
            if (
              row.status !== 'OVERDUE_REVIEW' ||
              !row.terms?.disposalAfterGrace ||
              !row.dueAt ||
              row.extensionRequest ||
              now.getTime() < row.dueAt.getTime() + 2 * PAWN_DAY_MS ||
              !g.complianceApproval ||
              !g.financeApproval ||
              g.complianceApproval.by === g.financeApproval.by ||
              !g.notice ||
              new Date(g.notice.eligibleAt) > now ||
              data.authorized !== true ||
              data.contractEligibilityVerified !== true
            )
              throw HttpError.conflict(
                'Require overdue review, valid notice, independent Compliance/Finance approvals and an authorized Admin decision.',
              );
            this.legal(row);
            Object.assign(details, {
              reason: text(data.details, 'authorized legal disposal decision', 5000),
              disposalReference: text(data.disposalReference, 'disposal authorization', 255),
              settlement: await this.estimate(row, now, transaction),
            });
            await row.update({ status: 'disposed', disposedAt: now }, { transaction });
            await PawnReminderService.cancel(id, row.dueAt, transaction);
            break;
          }
          case 'title_transfer': {
            await CommerceAccessService.require(userId, 'compliance', transaction);
            if (row.status !== 'disposed' || !row.disposedAt || data.ownershipTransferVerified !== true)
              throw HttpError.conflict('Complete the legal disposal and actual title transfer first.');
            const files = await this.evidence.bind(data.evidenceIds, userId, 'pawn', id, transaction);
            if (!files.length) throw HttpError.badRequest('Upload supporting evidence for this verification.');
            const titleTransfer = {
              by: userId,
              at: new Date().toISOString(),
              reference: text(data.details, 'completed transfer of title'),
              evidenceIds: files.map((file) => file.id),
            };
            await row.update({ governance: { ...row.governance, titleTransfer } }, { transaction });
            details.titleTransfer = titleTransfer;
            break;
          }
          case 'cancel': {
            if (
              row.disbursedAt ||
              row.custodyAt ||
              !['submitted', 'quoted', 'accepted', 'contract_confirmed'].includes(row.status)
            )
              throw HttpError.conflict(
                'Custody requires an actual handback; disbursed contracts require redemption or contractual resolution.',
              );
            details.reason = text(data.details, 'cancellation reason');
            await row.update({ status: 'cancelled' }, { transaction });
            break;
          }
          default:
            throw HttpError.badRequest('Unsupported pawn action.');
        }
        await row.update({ version: row.version + 1 }, { transaction });
        await this.event(row, userId, action, details, transaction);
      })
      .catch((error) => {
        if (error instanceof UniqueConstraintError)
          throw HttpError.conflict('The contract or custody reference already belongs to another pledged asset.');
        throw error;
      });
    return this.detail(id, userId, admin);
  }
  private legal(row: PawnContractModel) {
    const p = row.terms?.policy;
    if (
      !p ||
      p.legalMode !== 'approved' ||
      !p.legalApprovedBy ||
      !p.legalReference ||
      !row.governance.identityVerified ||
      !row.governance.ownershipVerified ||
      row.governance.disputed
    )
      throw HttpError.conflict(
        'LEGAL_REVIEW_REQUIRED: chỉ mô phỏng; cần phê duyệt pháp lý, giấy tờ và quyền sở hữu trước giao dịch thật.',
      );
  }
  async payment(
    id: number,
    userId: number,
    data: Record<string, unknown>,
    kind: 'disbursement' | 'redemption' | 'extension_credit',
  ) {
    const amountVnd = amount(data.amountVnd),
      externalReference = reference(data.externalReference),
      reason = text(data.details, 'actual payment verification');
    if (data.moneyVerified !== true) throw HttpError.badRequest('Verify the actual completed bank transaction.');
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      await CommerceAccessService.require(userId, 'finance', transaction);
      await MoneyReferenceService.lock(externalReference, 'pawn_payment', transaction);
      const row = await this.locked(id, userId, true, transaction);
      const existing = await PawnPaymentModel.findOne({ where: { externalReference }, transaction });
      if (existing) {
        if (existing.pawnContractId !== id || existing.kind !== kind || Number(existing.amountVnd) !== amountVnd)
          throw HttpError.conflict('This transaction reference belongs to another payment.');
        return;
      }
      this.current(row, data.expectedVersion);
      if (!row.terms || !row.contractReference || !row.custodyAt)
        throw HttpError.conflict('Signed accepted terms and physical custody are required first.');
      this.legal(row);
      const now = new Date();
      let creditAppliedVnd = 0;
      const metadata: Record<string, unknown> = {};
      let principalVnd = 0,
        interestVnd = 0;
      if (kind === 'disbursement') {
        if (row.status !== 'in_custody' || row.disbursedAt || amountVnd !== row.terms.principalVnd)
          throw HttpError.conflict('Disburse the exact signed principal once after custody verification.');
        principalVnd = amountVnd;
        await row.update(
          { status: 'active', disbursedAt: now, dueAt: new Date(now.getTime() + row.terms.termDays * PAWN_DAY_MS) },
          { transaction },
        );
        await PawnReminderService.schedule(row, transaction);
      } else if (kind === 'extension_credit') {
        if (
          !['active', 'DUE_GRACE'].includes(row.status) ||
          !row.extensionRequest?.id ||
          !row.disbursedAt ||
          !row.dueAt
        )
          throw HttpError.conflict('An eligible extension request is required.');
        const flows = await PawnPaymentModel.findAll({
          where: { pawnContractId: id },
          transaction,
          order: [['id', 'ASC']],
        });
        const quote = pawnExtensionQuote(
          row.terms.principalVnd,
          row.terms.appraisalVnd,
          row.terms.policy,
          row.disbursedAt,
          row.dueAt,
          new Date(row.extensionRequest.proposedDueAt),
          flows.map((flow) => flow.get({ plain: true })),
        );
        const received = flows
          .filter(
            (flow) => flow.kind === 'extension_credit' && flow.metadata.extensionRequestId === row.extensionRequest!.id,
          )
          .reduce((sum, flow) => sum + Number(flow.amountVnd), 0);
        if (!quote.eligible || amountVnd > quote.creditDueVnd - received)
          throw HttpError.conflict(
            'Verify the exact remaining extension credit; the 80% cap is checked before credit.',
          );
        metadata.extensionRequestId = row.extensionRequest.id;
      } else {
        if (!['active', 'DUE_GRACE', 'OVERDUE_REVIEW', 'repaid'].includes(row.status) || !row.disbursedAt)
          throw HttpError.conflict('Only a disbursed contract can receive redemption payment.');
        const estimate = await this.estimate(row, now, transaction);
        if (amountVnd > estimate.remainingVnd || estimate.remainingVnd < 1)
          throw HttpError.conflict('Payment exceeds the current outstanding balance.');
        if (row.terms.policy.calculation === 'compound_0_3_v2') {
          const current = estimate as Awaited<ReturnType<typeof this.estimate>> & {
            creditAppliedVnd: number;
            interestOutstandingVnd: number;
            principalOutstandingVnd: number;
          };
          creditAppliedVnd = current.creditAppliedVnd;
          const cashInterest = Math.min(amountVnd, current.interestOutstandingVnd - creditAppliedVnd);
          principalVnd = Math.min(current.principalOutstandingVnd, amountVnd - cashInterest);
          interestVnd = cashInterest + creditAppliedVnd;
        } else {
          if (amountVnd !== estimate.remainingVnd)
            throw HttpError.conflict('Legacy contracts require a separately reviewed full settlement.');
          principalVnd = row.paidAt ? 0 : row.terms.principalVnd;
          interestVnd = amountVnd - principalVnd;
        }
        if (amountVnd === estimate.remainingVnd) {
          await row.update({ status: 'repaid', paidAt: row.paidAt || now }, { transaction });
          await PawnReminderService.cancel(id, row.dueAt, transaction);
        }
      }
      await PawnPaymentModel.create(
        {
          pawnContractId: id,
          actorUserId: userId,
          kind,
          amountVnd,
          principalVnd,
          interestVnd,
          creditAppliedVnd,
          metadata,
          externalReference,
          reason,
        },
        { transaction },
      );
      const governance = { ...row.governance, financeApproval: null, complianceApproval: null };
      await row.update({ version: row.version + 1, governance }, { transaction });
      await this.event(
        row,
        userId,
        kind,
        { amountVnd, principalVnd, interestVnd, externalReference, reason, dueAt: row.dueAt, policy: row.terms.policy },
        transaction,
      );
    });
    return this.detail(id, userId, true);
  }
  async intake(id: number, userId: number, data: Record<string, unknown>) {
    if (!Number.isSafeInteger(data.productId) || Number(data.productId) < 1 || data.actualPhotosVerified !== true)
      throw HttpError.badRequest('Choose an actual shop-photographed draft SKU.');
    const productId = Number(data.productId),
      reason = text(data.details, 'disposal-to-listing condition reconciliation');
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await this.locked(id, userId, true, transaction);
      if (row.productId) {
        if (row.productId !== productId)
          throw HttpError.conflict('This disposed asset already has source-linked inventory.');
        return;
      }
      this.current(row, data.expectedVersion);
      if (
        row.governance.disputed ||
        !row.governance.titleTransfer ||
        row.status !== 'disposed' ||
        !row.disposedAt ||
        !row.terms ||
        !row.disbursedAt
      )
        throw HttpError.conflict('Verified eligible contractual disposal must precede sellable inventory.');
      if (row.conditionCase && (row.conditionCase.productId !== productId || row.conditionCaseStatus !== 'resolved'))
        throw HttpError.conflict('SKU không khớp tổ hợp đã duyệt.');
      this.legal(row);
      const product = await activateOwnedCollectibleDraft(
        productId,
        row.asset.modelCode,
        row.terms.principalVnd,
        transaction,
        { publish: false, sourceType: 'pawn', sourceId: row.id, actorUserId: userId },
      );
      await product.update(
        { ownershipVerifiedAt: new Date(), ownershipReference: row.governance.titleTransfer.reference },
        { transaction },
      );
      await row.update({ productId, version: row.version + 1 }, { transaction });
      await this.event(
        row,
        userId,
        'intake',
        {
          productId,
          sku: product.sku,
          condition: product.get({ plain: true }),
          reason,
          acquisitionCostBasis: 'disbursed_principal',
        },
        transaction,
      );
    });
    return this.detail(id, userId, true);
  }

  async publish(id: number, userId: number, data: Record<string, unknown>) {
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await this.locked(id, userId, true, transaction);
      this.current(row, data.expectedVersion);
      this.legal(row);
      if (
        row.governance.disputed ||
        !row.governance.titleTransfer ||
        row.status !== 'disposed' ||
        !row.productId ||
        !row.disposedAt ||
        data.actualPhotosVerified !== true
      )
        throw HttpError.conflict('Xác nhận nhập kho và ảnh thật sau xử lý tài sản trước khi xuất bản.');
      const product = await ProductModel.findByPk(row.productId, { transaction, lock: transaction.LOCK.UPDATE });
      if (
        !product ||
        product.partnerId ||
        product.stock < 1 ||
        product.inventoryStatus !== 'available' ||
        !product.targetPriceApprovedAt ||
        !product.pricingReferenceMemberVnd ||
        !product.imageUrl.startsWith('/uploads/')
      )
        throw HttpError.conflict('SKU chưa đủ ảnh, giá được duyệt hoặc tồn sẵn bán.');
      await product.update(
        { isArchived: false, listingStatus: 'published', publicationRequiresIntake: false },
        { transaction },
      );
      await row.update({ version: row.version + 1 }, { transaction });
      await this.event(row, userId, 'published', { productId: product.id }, transaction);
    });
    return this.detail(id, userId, true);
  }

  async addCaseEvidence(id: number, userId: number, data: Record<string, unknown>) {
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const row = await this.locked(id, userId, false, transaction);
      this.current(row, data.expectedVersion);
      if (row.conditionCaseStatus !== 'needs_evidence')
        throw HttpError.conflict('Shop chưa yêu cầu bổ sung bằng chứng.');
      const files = await this.evidence.bind(data.evidenceIds, userId, 'pawn', row.id, transaction);
      if (!files.length) throw HttpError.badRequest('Chọn ảnh/bằng chứng cần bổ sung.');
      await row.update({ conditionCaseStatus: 'pending', version: row.version + 1 }, { transaction });
      await this.event(
        row,
        userId,
        'condition_evidence_added',
        { evidenceIds: files.map((file) => file.id) },
        transaction,
      );
      await new NotificationDispatchService().alertAdmins(
        {
          kind: 'service_condition_proposal',
          orderId: null,
          dedupeKey: `pawn:${row.id}:evidence:${row.version}`,
          title: 'Khách đã bổ sung bằng chứng tình trạng',
          content: `Yêu cầu cầm #${row.id}. Xem /admin/pawn`,
        },
        transaction,
      );
    });
    return this.detail(id, userId);
  }
}
