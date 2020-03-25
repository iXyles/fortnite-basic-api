/* eslint-disable no-console */
const { Client } = require('../index.js'); // this should be 'fortnite-basic-api' in regular usage

// Creation of the Client, autokill will kill the session when client is disposed.
// If you are not giving any tokens it will use the default ones that are needed.
// If you got rate limited (captcha_invalid) you can use an exchangeCode to generate a deviceauth.
// You get the exchangeCode at https://www.epicgames.com/id/login?redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Fid%2Fapi%2Fexchange.
// Remember that you must be logged in with the account you want at https://epicgames.com
// AND BE CAREFUL! The generated code bypasses all 2FA logins & credentials, so do not share it.
const client = new Client({
  email: process.env.FORTNITE_EMAIL, // PLEASE USE ENV VARIABLES!
  //password: process.env.FORTNITE_PASSWORD, - Since we are using deviceAuth this is not required
  useDeviceAuth: true,
  removeOldDeviceAuths: true,
  deviceAuthPath: './fbadeviceauths.json', // Default is './fbadeviceauths.json'
  // You should not have to update any of the tokens.
  launcherToken: 'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=',
  fortniteToken: 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=',
  // iosToken: 'token' // this does not have to be changed unless something changes
  autokill: true,
});

// Example of usage
(async () => {
  // EMAIL should be same as the account logging in with exchange!
  // The reason is that the deviceauth will be saved under "client.email"
  // In the JSON file on disk

  // This is where the magic happen
  console.log('Success creation of device auth',
    await client.createDeviceAuthFromExchangeCode());

  // Perform the login process of the "client"
  console.log('Success login with created device auth',
    await client.authenticator.login());

  const parallel = await Promise.all([
    client.lookup.accountLookup('iXyles'),
    client.authenticator.accountId,
  ]);

  (parallel).forEach((result) => {
    console.log(result);
  });

  // Node will die and print that the session has been killed if login was successful
})();
