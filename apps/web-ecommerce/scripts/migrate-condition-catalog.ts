/* eslint-disable @typescript-eslint/no-require-imports -- Configure the isolated environment before loading application modules. */
import type ProviderType from '../src/core/server/database/Database.Provider';
import type MigrationType from '../src/core/server/services/catalog/CatalogMigrationService';
import type UserType from '../src/core/server/database/internal/models/User.Model';
import fs from 'fs/promises';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
Object.assign(process.env, { SEED_DATA: 'false', DROP_TABLES: 'false', DISABLE_BACKGROUND_JOBS: 'true' });
const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  const DatabaseProvider = require('../src/core/server/database/Database.Provider').default as typeof ProviderType;
  try {
    await DatabaseProvider.initialize();
    const Service = require('../src/core/server/services/catalog/CatalogMigrationService')
      .default as typeof MigrationType;
    const service = new Service();
    const output = argument('report');
    const apply = argument('apply');
    if (output && !apply) {
      const report = await service.report();
      await fs.writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
      console.log(
        JSON.stringify({
          products: report.rows.length,
          reviewRequired: report.rows.filter((row) => row.issues.length).length,
          secondaryReferences: report.secondaryReferences.length,
          report: output,
        }),
      );
    } else if (apply && argument('decisions') && argument('actor')) {
      const actorId = Number(argument('actor'));
      const UserModel = require('../src/core/server/database/internal/models/User.Model').default as typeof UserType;
      const actor = await UserModel.findByPk(actorId);
      if (!actor?.isActive || actor.role !== 'ADMIN') throw new Error('An active admin --actor is required.');
      console.log(
        JSON.stringify(
          await service.apply(
            JSON.parse(await fs.readFile(apply, 'utf8')),
            JSON.parse(await fs.readFile(argument('decisions')!, 'utf8')),
            actorId,
          ),
        ),
      );
    } else
      throw new Error(
        'Use --report=<new-file.json>, or --apply=<report.json> --decisions=<decisions.json> --actor=<admin-id>.',
      );
  } finally {
    await DatabaseProvider.getInstance().close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
