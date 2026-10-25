import Logger from '../../../../../shared/server/utils/logger';
import { failIfStrict } from './Seeder';
import AgentSettingModel from '../models/AgentSetting.Model';
import {
  AGENT_SETTING_DEFAULTS,
  AGENT_SETTING_KEYS,
  AgentSettings,
  TrendKeyword,
} from '../../../services/AgentSettingDefinitions';

// Inserts the default of every setting that has no row yet (never overwrites an admin's value). Used by the seed and
// by the migration that creates the table, so every database has all keys.
export const ensureAgentSettingDefaults = async (overrides: Partial<AgentSettings> = {}): Promise<void> => {
  await AgentSettingModel.bulkCreate(
    AGENT_SETTING_KEYS.map((key) => ({ key, value: overrides[key] ?? AGENT_SETTING_DEFAULTS[key], version: 1 })),
    { ignoreDuplicates: true },
  );
};

// Development data: Google Trends keywords for the shop's model lines (the seeded trend history uses them).
export const DEV_TREND_KEYWORDS: TrendKeyword[] = [
  { keyword: 'metal build', category: 'alloy-figures' },
  { keyword: 'mô hình hợp kim', category: 'alloy-figures' },
  { keyword: 'motor nuclear', category: 'mecha-model-kits' },
  { keyword: 'mô hình lắp ráp', category: 'mecha-model-kits' },
  { keyword: 'cangdao', category: 'alloy-figures' },
  { keyword: 'mecha kit', category: 'mecha-model-kits' },
];

export const seedAgentSettingData = async (): Promise<void> => {
  try {
    await ensureAgentSettingDefaults({ 'market.trend_keywords': DEV_TREND_KEYWORDS });
    Logger.INFO(`${AGENT_SETTING_KEYS.length} agent settings seeded (defaults).`);
  } catch (error) {
    Logger.ERROR('Error seeding the agent settings:', error);
    failIfStrict(error);
  }
};
