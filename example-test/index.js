/* eslint-disable no-console */
const { Client } = require('../index.js');

// Creation of the Client
const client = new Client({
  email: '',
  password: '',
  launcherToken: 'MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3ZmI5YjA3NDg5ZDMxM2I0MWE=',
  fortniteToken: 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=',
});

// Example of usage
(async () => {
  console.log(await client.login());
  console.log(await client.getV1Stats('iXyles'));
  console.log(await client.getV2Stats('iXyles'));
  console.log(await client.getServerStatus());
  // Node will die and print that the session has been killed if login was successful
})();
