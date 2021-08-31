const express = require('express');
const databaseClient = require('./databaseConnect');

const app = express();
app.use(express.json());

require('./databaseConnect');
require('./routes/authenticationRoutes')(app);
require('./routes/viewMeetingRoutes')(app);
require('./routes/reportRoutes')(app);
require('./routes/freeSlotRoutes')(app);
require('./routes/bookMeetingRoutes')(app);
require('./routes/clearScheduleRoutes')(app);
require('./routes/userPreferenceRoutes')(app);

databaseClient.connect();

app.listen(5000);
