exports.up = function(knex) {
  return knex.schema
    .createTable('users', function(table) {
      table.string('address').primary();
      table.decimal('balance', 20, 8).notNullable().defaultTo(0);
      table.timestamps(true, true);
    })
    .then(function() {
      return knex.schema.createTable('transactions', function(table) {
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
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('transactions')
    .then(function() {
      return knex.schema.dropTable('users');
    });
}; 