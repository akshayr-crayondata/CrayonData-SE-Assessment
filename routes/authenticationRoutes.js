const databaseClient = require('../databaseConnect');
const cryptoJS = require('crypto-js');

module.exports = app => {

  // SIGN UP ROUTE
  app.post('/signup', async (request, response) => {
    const {
      username,
      password
    } = request.body;

    // API ENHANCEMENT 1
    // To store the password securely in the database we can utilise a one way hash function
    // like sha256. While the user is logging in, the plain text password will be compared against
    // stored hash value and depending on whether it matches authorization is given

    try {
      await databaseClient.query(
        'INSERT INTO users (username, password) VALUES($1, $2)',
        [username, cryptoJS.SHA256(password).toString()]
      );
      response.json({
        "message": "Successfully created"
      });
    } catch (error) {
      // "23505" is the error code for primary key violation
      if (error.code == "23505") {
        response.status(400).json({
          "message": "Cannot insert user as there exists another user with the same username."
        });
      } else {
        response.status(500).json({
          "message": error.detail
        });
      }
    }
  });

  // LOGIN ROUTE
  app.get('/login', async (request, response) => {
    const {
      username,
      password
    } = request.body;
    await databaseClient.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, cryptoJS.SHA256(password).toString()],
      (err, result) => {
        if (result.rowCount === 1) {
          response.json({
            "message": "Login Successful",
            "username": username
          });
        } else {
          response.status(400).json({
            "message": "Login unsuccessful. Invalid username or password"
          });
        }
      }
    );
  });
}
