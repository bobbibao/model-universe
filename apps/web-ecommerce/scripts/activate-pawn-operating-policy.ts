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
const reference = 'docs/business/pawn-operating-approval-2026-10-28.md';
(async () => {
  if (!process.argv.includes('--apply-owner-operating-policy'))
    throw new Error('Explicit owner-policy activation flag required.');
  await DatabaseProvider.initialize();
  try {
    const owner = await UserModel.findOne({ where: { email: process.env.ADMIN_EMAIL, role: 'ADMIN', isActive: true } });
    if (!owner) throw new Error('Configured active shop owner not found.');
    const service = new CommercePolicyService(),
      current = await service.approved('pawn');
    if (
      current.settings.approvalType === 'owner_operational' &&
      current.settings.dailyRateBasisPoints === 0 &&
      current.settings.legalReference === reference
    ) {
      console.log(`Owner operating policy already active: v${current.version}, interest 0%.`);
      return;
    }
    const row = await service.approve(
      'pawn',
      {
        calculation: 'compound_0_3_v2',
        cashFlowClock: 'elapsed_24h_periods',
        legalMode: 'approved',
        approvalType: 'owner_operational',
        legalReference: reference,
        dailyRateBasisPoints: 0,
        dayCount: 'completed_days',
        rounding: 'nearest',
        graceDays: 2,
        interestStopEvent: 'verified_repayment',
      },
      current.version,
      owner.id,
      'Chủ shop ủy quyền qua phiên làm việc 28/10/2026: tạo phê duyệt vận hành nội bộ, chính sách mới 0% lãi/không phí ẩn; không tạo chứng nhận pháp lý bên ngoài.',
    );
    console.log(`Activated owner operating policy v${row.version}: 0% interest. Historical contracts unchanged.`);
  } finally {
    await DatabaseProvider.getInstance().close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
