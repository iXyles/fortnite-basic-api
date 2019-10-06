# fortnite-basic-api
[![npm version](https://img.shields.io/npm/v/fortnite-basic-api.svg)](https://npmjs.com/package/fortnite-basic-api)
[![npm downloads](https://img.shields.io/npm/dm/fortnite-basic-api.svg)](https://npmjs.com/package/fortnite-basic-api)
[![license](https://img.shields.io/npm/l/fortnite-basic-api.svg)](https://github.com/iXyles/fortnite-basic-api/blob/master/LICENSE)

__Basic Fortnite API for stats and server status built with async/await__

Inspired by other repos about Fortnite API's as:

- https://github.com/SzymonLisowiec/node-epicgames-client

- https://github.com/qlaffont/fortnite-api

Which I previously used fortnite-api but have gotten issues with unhandledrejections which causing issues in other projects. Therefore I rebuilt with focus on Async/await to resolve the issues and adding support for V2 API endpoint.

# BREAKING CHANGES
V1.3.0 Changed location of where you find "lookup, stats, authenticator" data, check index.js in Client to see more regarding it.
V1.3.2 Change the launcher token to the given on in the example below or else it will not work.

Example usage: 
```
const { Client, Communicator, FriendStatus } = require('fortnite-basic-api');

// Creation of the Client
const client = new Client({
  email: '',
  password: '',
  launcherToken: 'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=',
  fortniteToken: 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=',
});

// Creation of communicator
const communicator = new Communicator(client);

// Example of usage
(async () => {
  // Perform the login process of the "client"

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
```

# License
MIT License

Copyright (c) 2019 iXyles

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
