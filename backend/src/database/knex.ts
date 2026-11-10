import knex, { Knex } from 'knex';
import knexConfig from '../config/knexfile';
import { config } from '../config';

const environment = config.nodeEnv === 'production' ? 'production' : (config.nodeEnv === 'test' ? 'test' : 'development');
const selectedConfig = knexConfig[environment] || knexConfig.development;

let dbInstance: Knex | null = null;

export const getDb = (): Knex => {
  if (!dbInstance) {
    dbInstance = knex(selectedConfig);
  }
  return dbInstance;
};

export const testDatabaseConnection = async (): Promise<{ connected: boolean; latencyMs: number; error?: string }> => {
  const db = getDb();
  const start = Date.now();
  try {
    await db.raw('SELECT 1 AS health_check');
    const latencyMs = Date.now() - start;
    return { connected: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { connected: false, latencyMs, error: err.message || String(err) };
  }
};

export const closeDatabaseConnection = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
};

export default getDb;
