import knex from 'knex';
import { knexSnakeCaseMappers } from 'objection';

const config = {
  client: 'sqlite3',
  connection: {
    filename: process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : './data/dogelayer.sqlite3'
  },
  useNullAsDefault: true,
  migrations: {
    directory: './migrations'
  },
  ...knexSnakeCaseMappers()
};

export const db = knex(config); 