// Explicit one-time local administration under the owner's 2026-10-28 instruction. Never called at startup.
import { loadEnvConfig } from '@next/env';
import DatabaseProvider from '../src/core/server/database/Database.Provider';
import UserModel from '../src/core/server/database/internal/models/User.Model';
import CommercePolicyService from '../src/core/server/services/CommercePolicyService';

loadEnvConfig(process.cwd(), false);
Object.assign(process.env, {
  NODE_ENV: 'production',
  SEED_DATA: 'false',
  DROP_TABLES: 'false',
  DISABLE_BACKGROUND_JOBS: 'true',
});
const reference = 'docs/business/pawn-rate-0-3-amendment-2026-10-28.md';
(async () => {
  if (!process.argv.includes('--apply-owner-rate-0-3'))
    throw new Error('Explicit owner-policy activation flag required.');
  await DatabaseProvider.initialize();
  try {
    const owner = await UserModel.findOne({ where: { email: process.env.ADMIN_EMAIL, role: 'ADMIN', isActive: true } });
    if (!owner) throw new Error('Configured active shop owner not found.');
    const service = new CommercePolicyService(),
      current = await service.approved('pawn');
    if (
      current.settings.approvalType === 'owner_rate_0_3' &&
      current.settings.dailyRateBasisPoints === 30 &&
      current.settings.legalReference === reference
    ) {
      console.log(`Owner operating policy already active: v${current.version}, interest 0.3%/day.`);
      return;
    }
    const row = await service.approve(
      'pawn',
      {
        calculation: 'compound_0_3_v2',
        cashFlowClock: 'elapsed_24h_periods',
        legalMode: 'approved',
        approvalType: 'owner_rate_0_3',
        legalReference: reference,
        dailyRateBasisPoints: 30,
        dayCount: 'completed_days',
        rounding: 'nearest',
        graceDays: 2,
        interestStopEvent: 'verified_repayment',
      },
      current.version,
      owner.id,
      'Chủ shop yêu cầu rõ ngày 28/10/2026: khôi phục 0,3%/ngày (30 bps), lãi kép, tổng lãi không vượt gốc theo kế hoạch đã chốt. Ghi chỉ định của chủ shop, không tạo chứng nhận pháp lý bên ngoài.',
    );
    console.log(
      `Activated owner operating policy v${row.version}: 0.3% daily compound interest; total interest capped at principal. Historical contracts unchanged.`,
    );
  } finally {
    await DatabaseProvider.getInstance().close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
