import knex, { Knex } from 'knex';
import knexConfig from '../config/knexfile';
import { config } from '../config';

const environment = config.nodeEnv === 'production' ? 'production' : (config.nodeEnv === 'test' ? 'test' : 'development');
const dbConfig = knexConfig[environment] || knexConfig.development;
const db: Knex = knex(dbConfig);

async function testConnection() {
  console.log('====================================================');
  console.log('TalentHub MySQL Connection Diagnostic & Test Suite');
  console.log('====================================================');
  console.log(`Node Environment:   ${environment}`);
  console.log(`Database Driver:    ${config.database.driver}`);
  console.log(`Target Host:        ${config.database.host}`);
  console.log(`Target Port:        ${config.database.port}`);
  console.log(`Database Name:      ${config.database.name}`);
  console.log(`Database User:      ${config.database.user}`);
  console.log(`SSL Enabled:        ${config.database.ssl ? 'Yes' : 'No'}`);
  console.log(`Pool Configuration: min=${config.database.pool.min}, max=${config.database.pool.max}`);
  console.log('----------------------------------------------------');

  const start = Date.now();
  try {
    const [rawVersion]: any = await db.raw('SELECT VERSION() AS version, CURRENT_USER() AS user, DATABASE() AS current_db');
    const versionInfo = Array.isArray(rawVersion) ? rawVersion[0] : rawVersion;
    const latency = Date.now() - start;

    console.log('Database Connection: SUCCESSFUL');
    console.log(`Round-trip Latency:  ${latency}ms`);
    console.log(`Server Version:      ${versionInfo.version}`);
    console.log(`Connected User:      ${versionInfo.user}`);
    console.log(`Selected Database:   ${versionInfo.current_db}`);

    // Inspect existing tables
    const [tables]: any = await db.raw(`
      SELECT TABLE_NAME, TABLE_ROWS, ENGINE, TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME;
    `);

    console.log('\nExisting Tables in Schema:');
    if (!tables || tables.length === 0) {
      console.log('  (No tables found. Ready for initial migration).');
    } else {
      tables.forEach((t: any) => {
        console.log(`  - ${t.TABLE_NAME.padEnd(28)} | Engine: ${t.ENGINE || 'VIEW'} | Collation: ${t.TABLE_COLLATION || 'N/A'}`);
      });
    }

    console.log('====================================================');
  } catch (err: any) {
    const latency = Date.now() - start;
    console.error('Database Connection: FAILED');
    console.error(`Attempt Duration:    ${latency}ms`);
    console.error(`Error Code:          ${err.code || 'UNKNOWN'}`);
    console.error(`Error Message:       ${err.message || String(err)}`);
    console.log('----------------------------------------------------');
    console.log('Troubleshooting tips:');
    console.log('1. Verify MySQL server is running (locally or docker: docker compose up database).');
    console.log('2. Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in backend/.env.');
    console.log('3. Ensure target database exists: CREATE DATABASE IF NOT EXISTS talenthub;');
    console.log('====================================================');
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

testConnection();
