import { Knex } from 'knex';

/**
 * TalentHub Knex Migration: Candidate Education and Work Experience Management
 * Version: 20261112000004
 *
 * Creates candidate_education and candidate_experience tables.
 */
export async function up(knex: Knex): Promise<void> {
  const hasEducation = await knex.schema.hasTable('candidate_education');
  if (!hasEducation) {
    await knex.schema.createTable('candidate_education', (table) => {
      table.string('id', 64).primary();
      table.string('candidate_id', 64).notNullable().index('idx_education_candidate');
      table.string('institution', 200).notNullable();
      table.string('degree', 150).notNullable();
      table.string('field_of_study', 150).nullable();
      table.string('start_date', 50).nullable();
      table.string('end_date', 50).nullable();
      table.boolean('is_current').notNullable().defaultTo(false);
      table.string('grade', 50).nullable();
      table.text('description').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table
        .foreign('candidate_id', 'fk_education_candidate')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
    });
  }

  const hasExperience = await knex.schema.hasTable('candidate_experience');
  if (!hasExperience) {
    await knex.schema.createTable('candidate_experience', (table) => {
      table.string('id', 64).primary();
      table.string('candidate_id', 64).notNullable().index('idx_experience_candidate');
      table.string('company', 200).notNullable();
      table.string('title', 150).notNullable();
      table.string('employment_type', 50).nullable();
      table.string('location', 150).nullable();
      table.string('start_date', 50).nullable();
      table.string('end_date', 50).nullable();
      table.boolean('is_current').notNullable().defaultTo(false);
      table.text('description').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table
        .foreign('candidate_id', 'fk_experience_candidate')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('candidate_experience');
  await knex.schema.dropTableIfExists('candidate_education');
}

