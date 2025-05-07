const { Pool } = require('pg');

const pool = new Pool({
 user: 'postgres',
 host: 'localhost',
 database: 'final',
 password: 'kjrnfhjufh',
 port: 5432,
});

module.exports = pool;
