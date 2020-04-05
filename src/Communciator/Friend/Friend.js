const Status = require('./Status.js');
const FriendStatus = require('./FriendStatus.js');
const Utils = require('../../Utils.js');

module.exports = class Friend {
  constructor(communicator, data = {}) {
    this.communicator = communicator;
    this.accountId = data.accountId;
    this.JID = Utils.makeJID(this.accountId);
    this.friendStatus = data.friendStatus || Status.NONE;
    this.status = data.status;
    this.presence = data.presence;
    this.created = data.created || undefined; // Unknown, unless query via friendship
    this.favorite = typeof data.favorite === 'boolean' ? data.favorite : undefined; // Unknown, unless query via friendship
    this.platform = data.platform || ''
  }

  /**
   * Fetch data about user and update Friend
   */
  async fetch() {
    const data = await this.communicator.client.lookup.accountLookup(this.accountId);
    if (data) this.update(data);
  }

  /**
   * Update the friend user data
   * @param {object) data of the user to update
   */
  update(data) {
    if (!data.displayName) {
      Object.keys(data.externalAuths).forEach((key) => {
        this.displayName = `[${key}]${data.externalAuths[key].externalDisplayName}`;
      });
    } else this.displayName = data.displayName || 'UNKNOWN';
    this.externalAuths = data.externalAuths;
  }

  /**
   * Request and get the user presence and status
   * @param {string} type - What data to return to the caller
   */
  async getStatus(type = 'status') {
    await this.communicator.sendProbe(this.accountId);
    try {
      const result = await Utils.resolveEvent(this.communicator.events,
        `friend#${this.accountId}:presence`, 5000, (s) => s);

      this.status = result.status;
      this.presence = result.presence;

      return type === 'status' ? this.status : this.presence;
    } catch (err) {
      return `Could not retrieve ${type}`;
    }
  }

  /**
   * Try to remove the friend
   * @result {bool} if friend was success removed or not
   */
  async remove() {
    const result = await this.communicator.friendship.removeFriend(this.accountId);
    this.friendStatus = result ? FriendStatus.REMOVED : this.friendStatus;
    return this.friendStatus === FriendStatus.REMOVED;
  }

  /**
   * Try to add as friend, if friendStatus is set to `INCOMING`
   * @result {bool} if friend request was succesful accepted
   */
  async accept() {
    if (this.friendStatus === FriendStatus.INCOMING) {
      const result = await this.communicator.friendship.addFriend(this.accountId);
      this.friendStatus = result ? FriendStatus.ACCEPTED : this.friendStatus;
    }
    return this.friendStatus === FriendStatus.ACCEPTED;
  }

  /**
   * Try to reject an incoming friend request, if friendStatus is set to `INCOMING`
   * @result {bool} if friend request was succesful rejected
   */
  async reject() {
    if (this.friendStatus === FriendStatus.INCOMING) {
      const result = await this.communicator.friendship.removeFriend(this.accountId);
      this.friendStatus = result ? FriendStatus.REJECTED : this.status;
    }
    return this.friendStatus === FriendStatus.REJECTED;
  }

  /**
   * Send a message to the friend
   * @param {strirng} message that shall be sent
   * @result {bool} if message was sent or not
   */
  async sendMessage(message) {
    if (this.friendStatus === FriendStatus.ACCEPTED) {
      this.communicator.friendship.sendMessage(this.accountId, message);
    }

    return this.friendStatus === FriendStatus.ACCEPTED;
  }
};
