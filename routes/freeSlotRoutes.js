const databaseClient = require('../databaseConnect');
const {
  checkUserExists
} = require('../middlewares/userExists');

// This free SLots API incldes the ENHANCEMENT to include dynamic duration of
// meetings as well

module.exports = app => {
  app.get('/freeSlots', async (request, response) => {
    const {
      username,
      date,
      number_of_minutes
    } = request.body;

    // Check if user exists
    const userPresent = await checkUserExists(username);
    if (!userPresent) {
      response.status(400).json({
        "message": "User does not exist"
      }).end();
      return;
    }

    // check if the number_of_minutes if defined  >= 5 minutes and <= 8 hours
    if (number_of_minutes) {
      if (number_of_minutes < 5 || number_of_minutes > 480) {
        response.status(400).json({
          "message": "Invalid number_of_minutes entered. Please enter as per 5 <= number_of_minutes <= 480"
        }).end();
        return;
      }
    }

    // Checking as to whether the requested date falls on a holiday

    const holidayList = await databaseClient.query(
      'SELECT date, holiday_name FROM holidays;'
    );

    const listOfHolidays = holidayList.rows;

    for (let i = 0; i < listOfHolidays.length; i++) {
      if (listOfHolidays[i].date == date) {
        // the requested date falls on a holiday

        response.status(400).json({
          "message": "Since it is " + listOfHolidays[i].holiday_name + ", the user will not be available"
        }).end();
        return;
      }
    }

    // Get start, end of day and weekly off-days based on user preference
    const userPreferenceDetails = await databaseClient.query(
      'SELECT working_start_time, working_end_time, weekly_off_days\
      FROM user_timings WHERE username = $1',
      [username]
    );

    // assigning dummy values so that we can reassign later
    let startOfDay = new Date();
    let endOfDay = new Date();

    let weekly_off_days = "";

    if (userPreferenceDetails.rowCount == 0) {
      // user preference not set for the user
      // by default we will assume the start_time to be 9 AM and end_time to be 6 PM

      startOfDay = new Date(date + ' ' + '09:00');
      endOfDay = new Date(date + ' ' + '18:00');
    } else {
      const start = Math.floor(userPreferenceDetails.rows[0].working_start_time / 100).toString() + ':' + (userPreferenceDetails.rows[0].working_start_time % 100).toString();
      const end = Math.floor(userPreferenceDetails.rows[0].working_end_time / 100).toString() + ':' + (userPreferenceDetails.rows[0].working_end_time % 100).toString();
      weekly_off_days = userPreferenceDetails.rows[0].weekly_off_days;

      startOfDay = new Date(date + ' ' + start);
      endOfDay = new Date(date + ' ' + end);
    }

    // check if the date is a weekly off day

    let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayOfTheWeek = days[new Date(date).getDay()];

    if (weekly_off_days.includes(dayOfTheWeek)) {
      response.status(200).json({
        "message": "The user will be out of office on this day. Please try another date."
      }).end();
      return;
    }

    const result = await databaseClient.query(
      'SELECT start_time, end_time FROM meetings\
      WHERE username = $1 AND date = $2\
      ORDER BY start_time;',
      [username, date]
    );

    const resultSet = result.rows;

    // check if there are no meetings for the user on that day
    // if that's the case then throughout the day all 30 minute intervals are free slots

    if (resultSet.length == 0) {
      // no meetings that day
      returnTimeSlots(startOfDay, endOfDay, number_of_minutes);
      response.status(200)
        .json(responseResult)
        .end();
      return;
    }

    // We have the start_time and end_time of meetings on that day, now we can calculate free freeSlots
    // Let's assume that the working hours for the day is from 9:00 AM to 6:00 PM
    // Within this period, if there is a 30 minutes vacancy we will return the slot.

    let responseResult = {};
    responseResult.freeSlots = []

    // The thresholdMinutes parameter is given 30 by default
    // In case the user wants to enter a custom number of minutes,  that can be sent as parameter and it would replace
    // the default amount of 30 minutes

    const returnTimeSlots = (start_time, end_time, thresholdMinutes) => {
      if (!thresholdMinutes) thresholdMinutes = 30;
      let diff = end_time.getTime() - start_time.getTime();
      let diffHrs = Math.floor((diff % 86400000) / 3600000);
      let diffMins = Math.round(((diff % 86400000) % 3600000) / 60000);
      diffMins += diffHrs * 60;
      if (diffMins >= thresholdMinutes) {
        // calculate start_time + 30 minutes
        let meetingEndTime = new Date(start_time.getTime() + (thresholdMinutes * 60 * 1000));
        responseResult.freeSlots.push({
          "meeting_start": start_time.toLocaleString('en', {
            timeZone: 'Asia/Kolkata'
          }).split(', ')[1],
          "meeting_end": meetingEndTime.toLocaleString('en', {
            timeZone: 'Asia/Kolkata'
          }).split(', ')[1]
        });
        returnTimeSlots(meetingEndTime, end_time, thresholdMinutes);
      } else {
        return;
      }
    }


    // from start of day to start of first meeting

    let firstMeeting = new Date(date + ' ' + Math.floor(resultSet[0].start_time / 100) + ':' + (resultSet[0].start_time % 100));
    returnTimeSlots(startOfDay, firstMeeting, number_of_minutes);

    // meeting slots between time between subsequent meetings

    for (let i = 0; i < resultSet.length - 1; i++) {
      let checkVacancySlotStart = new Date(date + ' ' + Math.floor(resultSet[i].end_time / 100) + ':' + (resultSet[i].end_time % 100));
      let checkVacancySlotEnd = new Date(date + ' ' + Math.floor(resultSet[i + 1].start_time / 100) + ':' + (resultSet[i + 1].start_time % 100));
      returnTimeSlots(checkVacancySlotStart, checkVacancySlotEnd, number_of_minutes);
    }

    // from end of last meeting to end of day

    let lastMeeting = new Date(date + ' ' + Math.floor(resultSet[resultSet.length - 1].end_time / 100) + ':' + (resultSet[resultSet.length - 1].end_time % 100));
    returnTimeSlots(lastMeeting, endOfDay, number_of_minutes);

    response.status(200)
      .json(responseResult);

  });
}
