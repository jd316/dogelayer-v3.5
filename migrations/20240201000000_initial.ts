import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.string('address').primary();
    table.decimal('balance', 20, 8).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('transactions', (table) => {
    table.increments('id').primary();
    table.enum('type', ['deposit', 'withdrawal']).notNullable();
    table.enum('status', ['pending', 'completed', 'failed']).notNullable();
    table.decimal('amount', 20, 8).notNullable();
    table.string('user_address').notNullable();
    table.string('dogecoin_address').nullable();
    table.string('txid').nullable();
    table.integer('confirmations').nullable();
    table.timestamps(true, true);

    table.foreign('user_address').references('users.address');
    table.index(['user_address', 'status']);
    table.index(['txid']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('transactions');
  await knex.schema.dropTable('users');
} 