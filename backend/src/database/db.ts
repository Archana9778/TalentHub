import { config } from '../config';
import { MySqlDatabase } from './mysqlDb';
import { JsonDatabase } from './jsonDb';

export type DatabaseInstance = MySqlDatabase | JsonDatabase;

const driver = (process.env.DB_DRIVER || config.database?.driver || 'mysql2').toLowerCase();

let activeDb: DatabaseInstance;

if (driver === 'json') {
  console.log('[TalentHub DB] Selected storage engine: JSON flat-file persistence (DB_DRIVER=json)');
  activeDb = new JsonDatabase();
} else if (driver === 'mysql' || driver === 'mysql2') {
  console.log(
    `[TalentHub DB] Selected storage engine: MySQL 8.0 (DB_DRIVER=${driver}) connected to ${config.database.host}:${config.database.port}/${config.database.name}`
  );
  activeDb = new MySqlDatabase();
} else {
  throw new Error(
    `[TalentHub DB] Unsupported database driver: "${driver}". Supported values are "mysql2" and "json".`
  );
}

export const db = activeDb;
export default db;
