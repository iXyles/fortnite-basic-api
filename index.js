/* eslint-disable global-require */
module.exports = {

  // Functionallity
  Client: require('./src/Client'),
  Communicator: require('./src/Communciator'),
  Status: require('./src/Communciator/Friend/Status.js'),
  FriendStatus: require('./src/Communciator/Friend/FriendStatus.js'),

  // Resources
  Endpoints: require('./resources/Endpoints'),
  JID: require('./resources/JID'), // Using old version, since new one is not working properly with epicgames

};
