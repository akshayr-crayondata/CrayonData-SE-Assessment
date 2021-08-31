const {
  Client
} = require('pg');

const databaseClient = new Client({
  host: 'kbzhrdbdev.c9x2ofbqrrou.us-east-1.rds.amazonaws.com',
  user: 'kbzhrdb1',
  password: 'kbzhrdb1',
  port: 5432,
  database: 'akshay'
});

module.exports = databaseClient;
