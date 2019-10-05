/* eslint-disable no-console */
const { Client, Communicator, FriendStatus } = require('../index.js');

// Creation of the Client
const client = new Client({
  email: '',
  password: '',
  launcherToken: 'MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3ZmI5YjA3NDg5ZDMxM2I0MWE=',
  fortniteToken: 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=',
});

// Creation of communicator
const communicator = new Communicator(client);

// Example of usage
(async () => {
  // Perform the login process of the "client"

  console.log(await client.login());

  // Setup communicator events
  communicator.events.on('session:started', () => {
    console.log('XMPP Client is fully connected');
    communicator.friendship.addFriend('iXyles'); // example of how to add a friend
  });

  communicator.events.on('friend:request', async (friendrequest) => {
    if (FriendStatus.INCOMING) console.log(await friendrequest.accept());
  });

  communicator.events.on('friend:added', async (friend) => {
    console.log(`You're now friend with: ${friend.accountId}`);
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
    console.log(friend.sendMessage('Send something back'));
  });

  // Then connect it
  console.log(await communicator.connect());

  // Since everything is async based, we can query everything parallel how ever we want with await
  const parallel = await Promise.all([
    // Supports both name & id
    client.stats.getV1Stats('iXyles'),
    client.stats.getV1Stats('96afefcb12e14e7fa1bcfab1189eae55'),

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
