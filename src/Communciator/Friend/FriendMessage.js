const Friend = require('./Friend.js');

module.exports = class FriendMessage extends Friend {
  constructor(communicator, data = {}) {
    super(communicator, data);
    this.message = data.message;
    this.time = new Date();
  }
};
