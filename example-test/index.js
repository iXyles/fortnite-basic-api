/* eslint-disable no-console */
const { Client, Communicator, FriendStatus } = require('../index.js');
const fs = require('fs');

// Creation of the Client, autokill will kill the session when client is disposed. 
// If you are not giving any tokens it will use the default ones that are needed.
const client = new Client({
  email: '',
  password: '',
  deviceAuth: () => JSON.parse(fs.readFileSync('./deviceauth.json', 'utf-8')),
  deleteOtherDeviceAuths: true
});

// Creation of communicator
const communicator = new Communicator(client);

// Example of usage
(async () => {
  // Perform the login process of the "client"

  client.authenticator.on('device_auth_created', d => fs.writeFileSync('./deviceauth.json', JSON.stringify(d)));
  console.log(await client.login());

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