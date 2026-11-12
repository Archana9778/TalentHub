import { Knex } from 'knex';

/**
 * TalentHub Migration: resume extraction and recruiter verification fields
 * Version: 20261111000003
 */
export async function up(knex: Knex): Promise<void> {
  const resumeDocsExists = await knex.schema.hasTable('resume_documents');
  if (resumeDocsExists) {
    const hasCol = await knex.schema.hasColumn('resume_documents', 'extraction_status');
    if (!hasCol) {
      await knex.schema.alterTable('resume_documents', (table) => {
        table.string('extraction_status', 32).defaultTo('pending');
        table.text('extracted_data_json', 'longtext').nullable();
        table.text('extraction_error').nullable();
        table.boolean('is_verified').defaultTo(false);
        table.string('verified_by_id', 64).nullable();
        table.string('verified_by_name', 255).nullable();
        table.dateTime('verified_at').nullable();
      });
    }
  }

  const candidatesExists = await knex.schema.hasTable('candidates');
  if (candidatesExists) {
    const hasCandidateVerified = await knex.schema.hasColumn('candidates', 'is_verified');
    if (!hasCandidateVerified) {
      await knex.schema.alterTable('candidates', (table) => {
        table.boolean('is_verified').defaultTo(false);
        table.string('verified_by_id', 64).nullable();
        table.string('verified_by_name', 255).nullable();
        table.dateTime('verified_at').nullable();
        table.text('extracted_profile_json', 'longtext').nullable();
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const resumeDocsExists = await knex.schema.hasTable('resume_documents');
  if (resumeDocsExists) {
    await knex.schema.alterTable('resume_documents', (table) => {
      table.dropColumn('extraction_status');
      table.dropColumn('extracted_data_json');
      table.dropColumn('extraction_error');
      table.dropColumn('is_verified');
      table.dropColumn('verified_by_id');
      table.dropColumn('verified_by_name');
      table.dropColumn('verified_at');
    });
  }

  const candidatesExists = await knex.schema.hasTable('candidates');
  if (candidatesExists) {
    await knex.schema.alterTable('candidates', (table) => {
      table.dropColumn('is_verified');
      table.dropColumn('verified_by_id');
      table.dropColumn('verified_by_name');
      table.dropColumn('verified_at');
      table.dropColumn('extracted_profile_json');
    });
  }
}

