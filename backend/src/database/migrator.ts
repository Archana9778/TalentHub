import knex, { Knex } from 'knex';
import knexConfig from '../config/knexfile';
import { config } from '../config';

const environment = config.nodeEnv === 'production' ? 'production' : (config.nodeEnv === 'test' ? 'test' : 'development');
const dbConfig = knexConfig[environment] || knexConfig.development;
const db: Knex = knex(dbConfig);

async function runMigrator() {
  const command = process.argv[2] || 'status';

  console.log('====================================================');
  console.log(`TalentHub Knex Database Migration Manager`);
  console.log(`Environment: ${environment}`);
  console.log(`Target Host: ${config.database.host}:${config.database.port}`);
  console.log(`Database:    ${config.database.name}`);
  console.log(`Command:     ${command.toUpperCase()}`);
  console.log('====================================================');

  try {
    switch (command.toLowerCase()) {
      case 'up':
      case 'latest': {
        console.log('Checking database connectivity before migration...');
        await db.raw('SELECT 1');
        console.log('Connected successfully. Running pending migrations...');
        const [batchNo, log] = await db.migrate.latest();
        if (log.length === 0) {
          console.log('Already up to date. No pending migrations.');
        } else {
          console.log(`Batch ${batchNo} completed. Applied ${log.length} migration(s):`);
          log.forEach((file: string) => console.log(`  + ${file}`));
        }
        break;
      }

      case 'down':
      case 'rollback': {
        console.log('Checking database connectivity before rollback...');
        await db.raw('SELECT 1');
        console.log('Connected successfully. Rolling back last migration batch...');
        const [batchNo, log] = await db.migrate.rollback();
        if (log.length === 0) {
          console.log('Already at the base version. No migrations were rolled back.');
        } else {
          console.log(`Batch ${batchNo} rolled back. Reverted ${log.length} migration(s):`);
          log.forEach((file: string) => console.log(`  - ${file}`));
        }
        break;
      }

      case 'status': {
        console.log('Checking database connectivity...');
        await db.raw('SELECT 1');

        // db.migrate.list() is the authoritative source of truth.
        // db.migrate.status() returns (applied_count - total_local_count), which
        // is 0 when all migrations are applied, positive when the database has
        // MORE applied migrations than local files (db is "ahead"), and negative
        // when there are LOCAL migrations that have not yet been applied (pending).
        // The negative case was previously mis-labelled "database is ahead".
        const [completed, pending] = await db.migrate.list();
        const statusCode = await db.migrate.status();

        console.log(`\nMigration Status Code: ${statusCode}`);
        if (pending.length === 0 && completed.length > 0) {
          console.log('✅ All migrations have been applied. Database is up to date.');
        } else if (pending.length > 0) {
          console.log(`⚠️  There are ${pending.length} pending migration(s) waiting to be applied.`);
        } else if (statusCode > 0) {
          console.log(`⚠️  Database has ${statusCode} migration(s) applied that are NOT present locally (database is ahead of local files).`);
        } else {
          console.log('ℹ️  No migrations found.');
        }

        console.log('\nApplied Migrations:');
        if (completed.length === 0) console.log('  (none)');
        completed.forEach((m: any) => console.log(`  [x] ${m.name}`));

        console.log('\nPending Migrations:');
        if (pending.length === 0) console.log('  (none)');
        pending.forEach((m: any) => console.log(`  [ ] ${m.file}`));
        break;
      }

      case 'unlock': {
        console.log('Forcing unlock of migration lock table...');
        await db.migrate.forceFreeMigrationsLock();
        console.log('Migration lock released successfully.');
        break;
      }

      default:
        console.error(`Unknown command: "${command}". Available commands: up | down | status | unlock`);
        process.exitCode = 1;
    }
  } catch (error: any) {
    console.error('\n[Migration Error]:', error.message || error);
    if (error.code) console.error(`Error Code: ${error.code}`);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

runMigrator();
