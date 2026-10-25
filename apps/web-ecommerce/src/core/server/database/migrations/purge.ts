import { QueryTypes, type Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';

// Deleting rows together with everything that refers to them, following the database's own foreign keys. Used only to
// remove data the owner asked to have gone entirely (the legacy apparel shop); ordinary deletions keep their history.

interface ForeignKey {
  table: string;
  column: string;
  refTable: string;
  // a: no action, r: restrict, c: cascade, n: set null, d: set default.
  rule: 'a' | 'r' | 'c' | 'n' | 'd';
}

const foreignKeys = (sequelize: Sequelize, transaction: Transaction) =>
  sequelize.query<ForeignKey>(
    `SELECT child.relname AS "table", col.attname AS "column", parent.relname AS "refTable", con.confdeltype AS rule
       FROM pg_constraint con
       JOIN pg_class child ON child.oid = con.conrelid
       JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN pg_attribute col ON col.attrelid = con.conrelid AND col.attnum = con.conkey[1]
      WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1 AND child.relnamespace = 'public'::regnamespace`,
    { type: QueryTypes.SELECT, transaction },
  );

// Deletes the rows `ids` of each root table and, first, every row referring to them (recursively). Rows that only
// point at them through ON DELETE SET NULL keep living with the reference cleared. Append-only tables are opened for
// the duration (their user triggers are disabled, foreign keys stay enforced). Returns the deleted rows per table.
export const purgeRows = async (
  sequelize: Sequelize,
  roots: Record<string, number[]>,
  transaction: Transaction,
): Promise<Record<string, number>> => {
  const keys = await foreignKeys(sequelize, transaction);
  const deleted: Record<string, number> = {};
  const seen = new Map<string, Set<number>>();
  const order: { table: string; ids: number[] }[] = [];

  // Collects children before parents: the deletion order.
  const collect = async (table: string, ids: number[]) => {
    const done = seen.get(table) ?? new Set<number>();
    seen.set(table, done);
    const fresh = [...new Set(ids)].filter((id) => !done.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => done.add(id));
    for (const key of keys.filter((fk) => fk.refTable === table && fk.rule !== 'n' && fk.rule !== 'd')) {
      const children = await sequelize.query<{ id: number }>(
        `SELECT id FROM "${key.table}" WHERE "${key.column}" IN (:ids)`,
        { replacements: { ids: fresh }, type: QueryTypes.SELECT, transaction },
      );
      await collect(
        key.table,
        children.map((row) => row.id),
      );
    }
    order.push({ table, ids: fresh });
  };
  for (const [table, ids] of Object.entries(roots)) await collect(table, ids);

  const tables = [...new Set(order.map((step) => step.table))];
  const triggered = (
    await sequelize.query<{ table: string }>(
      `SELECT DISTINCT event_object_table AS "table" FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND event_object_table IN (:tables)`,
      { replacements: { tables: tables.length ? tables : [''] }, type: QueryTypes.SELECT, transaction },
    )
  ).map((row) => row.table);
  for (const table of triggered) await sequelize.query(`ALTER TABLE "${table}" DISABLE TRIGGER USER`, { transaction });
  for (const step of order) {
    // Each step lists rows that nothing still refers to (their children were deleted in an earlier step).
    await sequelize.query(`DELETE FROM "${step.table}" WHERE id IN (:ids)`, {
      replacements: { ids: step.ids },
      transaction,
    });
    deleted[step.table] = (deleted[step.table] ?? 0) + step.ids.length;
  }
  for (const table of triggered) await sequelize.query(`ALTER TABLE "${table}" ENABLE TRIGGER USER`, { transaction });
  return deleted;
};
