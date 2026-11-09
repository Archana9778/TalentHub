import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionConfig: Knex.MySqlConnectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'talenthub',
  user: process.env.DB_USER || 'talenthub_user',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
};

const knexConfig: { [key: string]: Knex.Config } = {
  development: {
    client: process.env.DB_DRIVER || 'mysql2',
    connection: connectionConfig,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
    migrations: {
      directory: path.resolve(__dirname, '../database/migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, '../database/seeds'),
      extension: 'ts',
    },
  },

  test: {
    client: process.env.DB_DRIVER || 'mysql2',
    connection: {
      ...connectionConfig,
      database: process.env.DB_NAME_TEST || 'talenthub_test',
    },
    pool: { min: 1, max: 5 },
    migrations: {
      directory: path.resolve(__dirname, '../database/migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, '../database/seeds'),
      extension: 'ts',
    },
  },

  production: {
    client: 'mysql2',
    connection: connectionConfig,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    },
    migrations: {
      directory: path.resolve(__dirname, '../database/migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, '../database/seeds'),
      extension: 'ts',
    },
  },
};

export default knexConfig;
