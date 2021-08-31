const databaseClient = require('../databaseConnect');
const {
  checkUserExists
} = require('../middlewares/userExists');

module.exports = app => {
  app.post('/bookMeeting', async (request, response) => {

    // Getting required fields from request body
    const {
      username,
      date,
      start_time,
      end_time,
      attendees,
      title,
      description
    } = request.body;

    // Check if username and attendees are present in the users table

    let listOfParticipants = attendees.split(',');
    listOfParticipants.push(username);

    for (let i = 0; i < listOfParticipants.length; i++) {
      const userPresent = await checkUserExists(listOfParticipants[i]);
      if (!userPresent) {
        response.status(400).json({
          "message": listOfParticipants[i] + " does not exist in the database"
        });
        return;
      }
    }

    // check if start_time > end_time
    if (start_time >= end_time) {
      response.status(400).json({
        "message": "start_time cannot be greater than end_time."
      }).end();
      return;
    }

    // We need to check as to whether the start_time and end_time for the meeting coincides
    // with the exising meetings of the day
    // We assume that the time is in 24H format
    // Since the meetings don't lapse past one day (Because start time and end time have the same date),
    // we can iterate over the start and end times for the day and check for clashes

    let clashes = false;
    let i = 0;

    for (i = 0; i < listOfParticipants.length; i++) {
      const result = await databaseClient.query(
        'SELECT start_time, end_time FROM meetings \
        WHERE username = $1 AND \
        date = $2',
        [listOfParticipants[i], date]
      );
      const resultSet = result.rows;

      resultSet.forEach((meeting_times) => {
        let start = meeting_times.start_time;
        let end = meeting_times.end_time;

        if ((start_time >= start && start_time < end) || (end_time > start && end_time <= end)) {
          // clashes
          clashes = true;
          return;
        }

      });

      if (clashes)
        break;
    }

    if (clashes) {
      // send error response
      let returnInformationUsername = listOfParticipants[i];
      if (listOfParticipants[i] == username) {
        returnInformationUsername = "you";
      }
      response.status(400).json({
        "message": "Meeting not created as there is another meeting with coinciding time slot for " + returnInformationUsername
      }).end();
      return;
    } else {
      let meetingDetailsParams = [username, date, start_time, end_time, attendees, title];
      if (typeof description == 'undefined') {
        meetingDetailsParams.push('');
      } else {
        meetingDetailsParams.push(description);
      }

      // get meeting ID

      const gettingMeetingID = await databaseClient.query(
        'SELECT max(meeting_id) from meetings',
      );

      if (typeof gettingMeetingID.rows[0].max == 'undefined') {
        meetingDetailsParams.push(1);
      } else {
        meetingDetailsParams.push(gettingMeetingID.rows[0].max + 1);
      }

      // book the meeting for all the Participants

      meetingDetailsParams.push(false);

      for (let i = 0; i < listOfParticipants.length; i++) {
        meetingDetailsParams.splice(0, 1, listOfParticipants[i]);
        if (listOfParticipants[i] == username) {
          meetingDetailsParams.splice(meetingDetailsParams.length - 1, 1, true);
        }
        await databaseClient.query(
          'INSERT INTO meetings (username, date, start_time, end_time, attendees, title, description, meeting_id, is_organizer) \
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          meetingDetailsParams
        );
      }
      response.status(200)
        .json({
          "message": "Meet booking confirmation Successful!"
        });

    }
  });

  // API ENHANCEMENT 2
  // Book meeting route to set recurrent meeting

  app.post('/bookMeetingRecurrent', async (request, response) => {
    // Getting required fields from request body
    const {
      username,
      date,
      start_time,
      end_time,
      attendees,
      title,
      description,
      recurrent_frequency,
      recurrent_end_date
    } = request.body;

    // Check if username and attendees are present in the users table

    let listOfParticipants = attendees.split(',');
    listOfParticipants.push(username);

    for (let i = 0; i < listOfParticipants.length; i++) {
      const userPresent = await checkUserExists(listOfParticipants[i]);
      if (!userPresent) {
        response.status(400).json({
          "message": listOfParticipants[i] + " does not exist in the database"
        });
        return;
      }
    }

    // check if start_time > end_time
    if (start_time >= end_time) {
      response.status(400).json({
        "message": "start_time cannot be greater than end_time."
      }).end();
      return;
    }

    const startDate = new Date(date);
    const lastDate = new Date(recurrent_end_date);

    // check if recurrent_end_date is greater than Date
    if (startDate > lastDate) {
      response.status(400)
        .json({
          "message": "recurrent_end_date cannot be before date"
        })
        .end();
      return;
    }

    // check if recurrent_end_date exceeds starting date by more than one year
    let diffInMS = lastDate - startDate;
    let diffInDays = Math.floor(diffInMS / 86400000);
    if (diffInDays > 365) {
      response.status(400)
        .json({
          "message": "recurrent_end_date cannot exceed starting date by more than one year"
        })
        .end();
      return;
    }

    // get all the recurrent dates
    let listOfDatesToCheck = [];
    let previousDate = startDate;
    listOfDatesToCheck.push(previousDate.toISOString().substring(0, 10));
    switch (recurrent_frequency) {
      case 'daily':
        while (true) {
          let dateToAdd = new Date(previousDate.setDate(previousDate.getDate() + 1))
          previousDate = dateToAdd;
          if (dateToAdd > lastDate) {
            break;
          }
          listOfDatesToCheck.push(dateToAdd.toISOString().substring(0, 10));
        }
        break;
      case 'weekly':
        while (true) {
          let dateToAdd = new Date(previousDate.setDate(previousDate.getDate() + 7))
          previousDate = dateToAdd;
          if (dateToAdd > lastDate) {
            break;
          }
          listOfDatesToCheck.push(dateToAdd.toISOString().substring(0, 10));
        }
        break;
      case 'monthly':
        while (true) {
          let dateToAdd = new Date(previousDate.setMonth(previousDate.getMonth() + 1))
          previousDate = dateToAdd;
          if (dateToAdd > lastDate) {
            break;
          }
          listOfDatesToCheck.push(dateToAdd.toISOString().substring(0, 10));
        }
        break;
      default:
        response.status(400).json({
          "message": "Invalid recurrent frequency given"
        });
    }

    // We need to check as to whether the start_time and end_time for the meeting coincides
    // with the exising meetings of the day
    // We assume that the time is in 24H format
    // Since the meetings don't lapse past one day (Because start time and end time have the same date),
    // we can iterate over the start and end times for the day and check for clashes

    let clashes = false;
    let i = 0,
      j = 0;

    for (j = 0; j < listOfDatesToCheck.length; j++) {
      for (i = 0; i < listOfParticipants.length; i++) {
        const result = await databaseClient.query(
          'SELECT start_time, end_time FROM meetings \
          WHERE username = $1 AND \
          date = $2',
          [listOfParticipants[i], listOfDatesToCheck[j]]
        );
        const resultSet = result.rows;

        resultSet.forEach((meeting_times) => {
          let start = meeting_times.start_time;
          let end = meeting_times.end_time;

          if ((start_time >= start && start_time < end) || (end_time > start && end_time <= end)) {
            // clashes
            clashes = true;
            return;
          }
        });

        if (clashes)
          break;
      }
      if (clashes) break;
    }

    if (clashes) {
      // send error response
      let returnInformationUsername = listOfParticipants[i];
      if (listOfParticipants[i] == username) {
        returnInformationUsername = "you";
      }
      response.status(400).json({
        "message": "Meeting not created as there is another meeting with coinciding time slot for " + returnInformationUsername + " on " + listOfDatesToCheck[j]
      }).end();
      return;
    } else {
      // Run a loop over all the dates in listOfDatesToCheck
      for (j = 0; j < listOfDatesToCheck.length; j++) {
        let meetingDetailsParams = [username, listOfDatesToCheck[j], start_time, end_time, attendees, title];
        if (typeof description == 'undefined') {
          meetingDetailsParams.push('');
        } else {
          meetingDetailsParams.push(description);
        }

        // get meeting ID

        const gettingMeetingID = await databaseClient.query(
          'SELECT max(meeting_id) from meetings',
        );

        if (typeof gettingMeetingID.rows[0].max == 'undefined') {
          meetingDetailsParams.push(1);
        } else {
          meetingDetailsParams.push(gettingMeetingID.rows[0].max + 1);
        }

        // book the meeting for all the Participants

        meetingDetailsParams.push(false);

        for (let i = 0; i < listOfParticipants.length; i++) {
          meetingDetailsParams.splice(0, 1, listOfParticipants[i]);
          if (listOfParticipants[i] == username) {
            meetingDetailsParams.splice(meetingDetailsParams.length - 1, 1, true);
          }
          await databaseClient.query(
            'INSERT INTO meetings (username, date, start_time, end_time, attendees, title, description, meeting_id, is_organizer) \
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            meetingDetailsParams
          );
        }
      }

      response.status(200)
        .json({
          "message": "Meet booking confirmation Successful!"
        });
    }
  });
}
