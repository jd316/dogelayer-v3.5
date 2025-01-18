import fs from 'fs';
import path from 'path';
import { knex } from 'knex';
import knexConfig from '../knexfile';

// Create test database if it doesn't exist
const dbPath = path.join(__dirname, '../dev.sqlite3');
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '');
}

// Initialize test database
const db = knex(knexConfig.test);

before(async () => {
    // Run migrations
    await db.migrate.latest();
});

after(async () => {
    // Clean up
    await db.destroy();
    if (process.env.NODE_ENV === 'test') {
        fs.unlinkSync(dbPath);
    }
}); 