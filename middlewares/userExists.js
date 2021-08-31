const databaseClient = require('../databaseConnect');

async function checkUserExists(username) {
  const userPresent = await databaseClient.query(
    'SELECT username FROM users WHERE username = $1',
    [username]
  );
  if (userPresent.rowCount == 0) {
    return false;
  }
  return true;
}

module.exports.checkUserExists = checkUserExists;
