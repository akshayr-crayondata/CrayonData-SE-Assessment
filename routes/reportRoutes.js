const databaseClient = require('../databaseConnect');

module.exports = app => {
  app.get('/report', async (request, response) => {
    const {
      users,
      start_date,
      end_date
    } = request.body;

    if (users <= 0) {
      response.status(400).json({
        "message": "Please enter positive number of users"
      }).end();
      return;
    }

    const result = await databaseClient.query(
      'SELECT username, SUM(duration) FROM (\
	       SELECT username, \
         CASE WHEN (end_time - start_time) > 100 \
		     THEN ((((end_time / 100) - (start_time / 100)) - 1) * 60) + ((60 - (start_time % 100)) + (end_time % 100))\
		     ELSE ((60 - (start_time % 100)) + (end_time % 100))\
	       END\
	       AS duration\
	       FROM meetings\
	       WHERE TO_DATE(date, \'YYYY-MM-DD\') BETWEEN\
	       TO_DATE($2, \'YYYY-MM-DD\') AND TO_DATE($3, \'YYYY-MM-DD\')\
      ) AS totalDuration\
      GROUP BY username\
      ORDER BY SUM(totalDuration.duration) DESC\
      LIMIT $1;',
      [users, start_date, end_date]
    );
    const resultSet = result.rows;

    // check if resultSet is empty
    if (resultSet.length === 0) {
      response.status(200)
        .json({
          "message": "No users have booked meetings between start_date and end_date"
        });
      return;
    }

    let returnResult = {};
    returnResult.users = [];
    resultSet.forEach(entry => {
      returnResult.users.push({
        "username": entry.username,
        "duration": entry.sum
      });
    });

    response.status(200)
      .json(returnResult);

  });
}
