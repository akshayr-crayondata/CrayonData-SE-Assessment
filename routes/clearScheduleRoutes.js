const databaseClient = require('../databaseConnect');
const {
  checkUserExists
} = require('../middlewares/userExists');

module.exports = app => {

  // Clear calendar for a user on a specific day - ADDITIONAL API RELAVANT TO CALENDAR
  // Sometimes, professional may have some emergency on a specific day so they would have
  // to cancel all their meetings on that day.
  // This API would cater to that purpose

  // NOTE: If the meeting organizer clears the schedule, then the meeting should be deleted
  // under all the meeting attendees
  // But if one of the attendees wants to clear the schedule, then only his record will be deleted

  app.delete('/clearSchedule', async (request, response) => {
    const {
      username,
      date
    } = request.body;

    // Check if user exists
    const userPresent = await checkUserExists(username);
    if (!userPresent) {
      response.status(400).json({
        "message": "User does not exist"
      }).end();
      return;
    }

    // First we delete the meetings where the username is the organizer
    const result = await databaseClient.query(
      'SELECT meeting_id FROM meetings WHERE\
      username = $1 AND is_organizer = true\
      AND date = $2;',
      [username, date]
    )

    if (result.rowCount > 0) {
      // there exists meetings where the username is the organizer
      // in that case, delete all records which match the meeting_id
      const meetingsToDelete = result.rows;
      meetingsToDelete.forEach(async meetingID => {
        await databaseClient.query(
          'DELETE from meetings WHERE meeting_id = $1;',
          [meetingID.meeting_id],
          (err, result) => {
            if (err) {
              response.status(500)
                .json({
                  "message": "An error occured."
                }).end();
              return;
            }
          }
        );
      });
    }

    // now we check to delete the meetings where the username is an attendee

    await databaseClient.query(
      'DELETE from meetings WHERE username = $1 AND\
      date = $2',
      [username, date],
      (err, result) => {
        if(err) {
          response.status(500).json({
            "message" : "ERROR, meeting not cleared Successfully"
          }).end()
          return;
        }
      });

      response.status(200)
              .json({
                "message" : "Meetings Successfully Cleared"
              });
  });
}
