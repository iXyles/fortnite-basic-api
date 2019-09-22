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

  const parallel = await Promise.all([
    // Supports both name & id
    client.getV1Stats('iXyles'),
    client.getV1Stats('96afefcb12e14e7fa1bcfab1189eae55'),

    // Supports both name & id
    client.getV2Stats('iXyles'),
    client.getV2Stats('96afefcb12e14e7fa1bcfab1189eae55'),

    client.getServerStatus(),
    client.getBRNews('es'), // insert a different language code if wanted
    client.getBRStore(),
    client.getPVEInfo(),
    client.getBREventFlags(),
  ]);

  (parallel).forEach((result) => {
    console.log(result);
  });

  // Node will die and print that the session has been killed if login was successful
})();
