import { Knex } from 'knex';

/**
 * TalentHub Knex Migration: Activity Log / Audit Trail & Company Role Persistence
 * Version: 20261116000004
 *
 * 1. Enhances `recruiters` table with `company_role` column and backfills existing seed company admins.
 * 2. Enhances `jobs` table with `deleted_at` and `deleted_by` for soft deletions.
 * 3. Creates `activity_logs` table for full CRUD audit trail.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. recruiters table: add company_role and backfill
  const hasRecruiterCompanyRole = await knex.schema.hasColumn('recruiters', 'company_role');
  if (!hasRecruiterCompanyRole) {
    await knex.schema.alterTable('recruiters', (table) => {
      table.string('company_role', 32).notNullable().defaultTo('recruiter');
    });

    // Backfill known company admins
    await knex('recruiters')
      .whereIn('user_id', ['user-recruiter-1', 'user-recruiter-2'])
      .update({ company_role: 'admin' });
  }

  // 2. jobs table: soft-delete columns
  const hasJobDeletedAt = await knex.schema.hasColumn('jobs', 'deleted_at');
  if (!hasJobDeletedAt) {
    await knex.schema.alterTable('jobs', (table) => {
      table.timestamp('deleted_at').nullable().defaultTo(null).index('idx_jobs_deleted_at');
      table.string('deleted_by', 64).nullable().defaultTo(null);
    });
  }

  // 3. activity_logs table
  const hasActivityLogs = await knex.schema.hasTable('activity_logs');
  if (!hasActivityLogs) {
    await knex.schema.createTable('activity_logs', (table) => {
      table.string('id', 64).primary();
      table.string('company_id', 64).notNullable().index('idx_activity_company');
      table.string('actor_user_id', 64).notNullable().index('idx_activity_actor');
      table.string('actor_name', 150).notNullable();
      table.string('action', 32).notNullable().index('idx_activity_action');
      table.string('module', 64).notNullable().index('idx_activity_module');
      table.string('record_id', 64).notNullable();
      table.string('record_name', 255).notNullable();
      table.json('old_values').nullable();
      table.json('new_values').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index('idx_activity_created');
      table.index(['company_id', 'created_at'], 'idx_activity_company_created');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Safe no-op rollback: do not drop activity_logs, jobs soft-delete columns,
  // or recruiters.company_role in order to preserve audit history and avoid data loss
  // if a migration rollback is accidentally triggered.
}
