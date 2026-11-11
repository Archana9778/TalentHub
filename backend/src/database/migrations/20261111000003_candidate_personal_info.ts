import { Knex } from 'knex';

/**
 * TalentHub Knex Migration: Candidate Personal Information
 * Version: 20261111000003
 *
 * Adds date_of_birth and gender columns to candidates and users tables.
 */
export async function up(knex: Knex): Promise<void> {
  const hasCandDob = await knex.schema.hasColumn('candidates', 'date_of_birth');
  if (!hasCandDob) {
    await knex.schema.alterTable('candidates', (table) => {
      table.date('date_of_birth').nullable();
      table.string('gender', 32).nullable();
    });
  }

  const hasUserDob = await knex.schema.hasColumn('users', 'date_of_birth');
  if (!hasUserDob) {
    await knex.schema.alterTable('users', (table) => {
      table.date('date_of_birth').nullable();
      table.string('gender', 32).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCandDob = await knex.schema.hasColumn('candidates', 'date_of_birth');
  if (hasCandDob) {
    await knex.schema.alterTable('candidates', (table) => {
      table.dropColumn('date_of_birth');
      table.dropColumn('gender');
    });
  }

  const hasUserDob = await knex.schema.hasColumn('users', 'date_of_birth');
  if (hasUserDob) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('date_of_birth');
      table.dropColumn('gender');
    });
  }
}

