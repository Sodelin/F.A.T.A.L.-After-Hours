import { DatabaseSync } from 'node:sqlite';

/** Minimal native-SQLite implementation of D1's prepare/bind/first/all/run/batch interface. */
export function createD1(schema) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(schema);
  const wrap = (sql, args = []) => ({
    bind: (...next) => wrap(sql, next),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => run(sql, args),
    _sql: sql, _args: args,
  });
  const run = (sql, args) => {
    const result = sqlite.prepare(sql).run(...args);
    return { success: true, meta: { changes: Number(result.changes) } };
  };
  return {
    sqlite,
    prepare: wrap,
    batch: async statements => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => run(statement._sql, statement._args));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}
