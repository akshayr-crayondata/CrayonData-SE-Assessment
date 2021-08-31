const databaseClient = require('../databaseConnect');
const {
  checkUserExists
} = require('../middlewares/userExists');

module.exports = app => {
  // View Meetings API
  app.get('/viewMeeting', async (request, response) => {
    const {
      username,
      start_date,
      end_date
    } = request.body;

    // check if Username exists
    const userPresent = await checkUserExists(username);
    if (!userPresent) {
      response.status(400).json({
        "message": "User does not exist"
      }).end();
      return;
    }

    // check if start_date < end_date
    if (new Date(start_date) > new Date(end_date)) {
      response.status(400).json({
        "message": "start_date cannot be greater than end_date"
      }).end();
      return;
    }

    const result = await databaseClient.query(
      'SELECT date, start_time, end_time, title, description FROM meetings \
      WHERE username = $1 AND date IN ( \
        SELECT date FROM meetings WHERE \
        TO_DATE(date, \'YYYY-MM-DD\') BETWEEN \
        TO_DATE($2, \'YYYY-MM-DD\') AND TO_DATE($3, \'YYYY-MM-DD\') \
        GROUP BY date\
      )\
      ORDER BY date, start_time;',
      [username, start_date, end_date]
    );
    const resultSet = result.rows;

    // check if resultSet is empty
    if (resultSet.length === 0) {
      response.status(200)
        .json({
          "message": "User has not booked meetings between start_date and end_date"
        });
      return;
    }

    var responseToReturn = {};

    // Create JSON response
    resultSet.forEach(meeting => {
      if (!responseToReturn[meeting.date])
        responseToReturn[meeting.date] = []
      responseToReturn[meeting.date].push({
        "start_time": meeting["start_time"],
        "end_time": meeting["end_time"],
        "title": meeting["title"],
        "description": meeting["description"]
      })
    });

    response.status(200)
      .json(responseToReturn);
  });

  // API ENHANCEMENT 3
  // viewCalendar API

  app.get('/viewMeetingForUsername', async (request, response) => {

    const {
      username,
      username_check,
      start_date,
      end_date
    } = request.body;

    // check if user and user to check exists
    const userPresent = await checkUserExists(username);
    if (!userPresent) {
      response.status(400).json({
        "message": "User does not exist"
      }).end();
      return;
    }

    const userCheckPresent = await checkUserExists(username_check);
    if (!userCheckPresent) {
      response.status(400).json({
        "message": "User to check does not exist"
      }).end();
      return;
    }

    const result = await databaseClient.query(
      'SELECT username, date, title, start_time, end_time, \
        CASE WHEN $1 = $2 THEN attendees END AS attendees,\
        CASE WHEN $1 = $2 THEN description END AS description\
        FROM meetings\
        WHERE username = $2 AND TO_DATE(date, \'YYYY-MM-DD\') BETWEEN \
        TO_DATE($3,\'YYYY-MM-DD\' ) AND TO_DATE($4, \'YYYY-MM-DD\')\
        ORDER BY TO_DATE(date, \'YYYY-MM-DD\'), start_time;',
      [username, username_check, start_date, end_date]
    );
    const resultSet = result.rows;

    // check if resultSet is empty
    if (resultSet.length === 0) {
      response.status(200)
        .json({
          "message": "No meetings booked between start_date and end_date"
        });
      return;
    }

    let returnResult = {};
    returnResult.calendar = [];

    resultSet.forEach(meeting => {
      meetingDetails = {};
      for (const key in meeting) {
        if (meeting[key]) {
          meetingDetails[key] = meeting[key];
        }
      }
      returnResult.calendar.push(meetingDetails);
    });

    response.status(200)
      .json(returnResult);

  });
}
