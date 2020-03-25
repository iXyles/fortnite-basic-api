/* eslint-disable no-console */
const { Client, Communicator, FriendStatus } = require('../index.js'); // this should be 'fortnite-basic-api' in regular usage

// Creation of the Client, autokill will kill the session when client is disposed.
// If you are not giving any tokens it will use the default ones that are needed.
// If you got rate limited (captcha_invalid) you can use an exchangeCode to generate a deviceauth.
// You get the exchangeCode at https://www.epicgames.com/id/login?redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Fid%2Fapi%2Fexchange.
// Remember that you must be logged in with the account you want at https://epicgames.com
// AND BE CAREFUL! The generated code bypasses all 2FA logins & credentials, so do not share it.
const client = new Client({
  email: process.env.FORTNITE_EMAIL, // Should be same as the account logging in!
  //password: process.env.FORTNITE_PASSWORD,- Since we are using deviceAuth this is not required
  useDeviceAuth: true,
  removeOldDeviceAuths: true,
  deviceAuthPath: './fbadeviceauths.json', // Default is './fbadeviceauths.json'
  // You should not have to update any of the tokens.
  launcherToken: 'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=',
  fortniteToken: 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=',
  // iosToken: 'token' // this does not have to be changed unless something changes
  autokill: true,
});

// Creation of communicator
const communicator = new Communicator(client);

// Example of usage
(async () => {
  // Perform the login process of the "client"
  console.log(await client.authenticator.login());

  // Setup communicator events
  communicator.events.on('session:started', async () => {
    console.log('XMPP Client is fully connected');
    console.log('Add friend: ', await communicator.friendship.addFriend('iXyles')); // example of how to add a friend
    console.log(await communicator.friendship.getFriends()); // get current friends
    console.log(await communicator.friendship.getIncomingFriendRequests()); // incoming
    console.log(await communicator.friendship.getOutgoingFriendRequests()); // outgoing
  });

  communicator.events.on('friend:request', async (friendrequest) => {
    if (friendrequest.friendStatus === FriendStatus.INCOMING) {
      console.log(friendrequest, await friendrequest.accept());
    }
  });

  communicator.events.on('reconnect', async (failure) => {
    if (failure) {
      console.log(failure); // reason to why it failed, currently only if token update failed
    }
  });

  communicator.events.on('friend:added', async (friend) => {
    console.log(`You're now friend with: ${friend.accountId}`);
  });

  communicator.events.on('friend:reject', async (friend) => {
    console.log(`You got rejected the friend request by: ${friend.accountId}`);
  });

  communicator.events.on('friend:removed', async (friend) => {
    console.log(`You're now unfriended with: ${friend.accountId}`);
  });

  communicator.events.on('friend:abort', async (friend) => {
    console.log(`Friendrequest aborted with: ${friend.accountId}`);
  });

  communicator.events.on('friend:presence', (friend) => {
    console.log(friend.presence);
  });

  communicator.events.on('friend:message', async (friend) => {
    console.log(await friend.getStatus());
    console.log('message', await friend.sendMessage('Send something back'));
  });

  // Then connect it
  console.log(await communicator.connect());

  // Since everything is async based, we can query everything parallel how ever we want with await
  const parallel = await Promise.all([
    // Supports both name & id
    client.stats.getV2Stats('iXyles'),
    client.stats.getV2Stats('96afefcb12e14e7fa1bcfab1189eae55'),

    // Or maybe just lookup?
    client.lookup.accountLookup('iXyles'),
    client.lookup.accountLookup('96afefcb12e14e7fa1bcfab1189eae55'),

    // or maybe a couple at a time?
    client.lookup.accountLookup(['iXyles', '96afefcb12e14e7fa1bcfab1189eae55']),

    client.getServerStatus(),
    client.getBRNews('es'), // insert a different language code if wanted
    client.getBRStore(),
    client.getPVEInfo(),
    client.getBREventFlags(),

    // or maybe the current logged in user accountId
    client.authenticator.accountId,
  ]);

  (parallel).forEach((result) => {
    console.log(result);
  });

  // Node will die and print that the session has been killed if login was successful
})();
