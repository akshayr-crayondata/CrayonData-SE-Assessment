const databaseClient = require('../databaseConnect');
const {
  checkUserExists
} = require('../middlewares/userExists');

module.exports = app => {
  // Set user preference API
  app.post('/setUserPreference', async(request, response) => {
    const {username, weekly_off_days, working_start_time, working_end_time} = request.body;

    // We will store the data which the user has given in a relation.
    // For weekly_off_days we will consider a commma separated string of days
    // Which the user will be away from work Eg. Saturday,Sunday
    // This user preference will impact the free slots API

    // check if Username exists
    const userPresent = await checkUserExists(username);
    if (!userPresent) {
      response.status(400).json({
        "message": "User does not exist"
      }).end();
      return;
    }

    await databaseClient.query(
        'INSERT INTO user_timings (username, weekly_off_days, working_start_time, working_end_time)\
        VALUES($1, $2, $3, $4)',
        [username, weekly_off_days, working_start_time, working_end_time],
        (err, result) => {
          if(err) {
            response.status(500).json({
              "message" : "Error occured in adding user preference"
            });
          }
        }
    )
    response.status(200).json({
      "message" : "User preference recorded!"
    });
  });
}
