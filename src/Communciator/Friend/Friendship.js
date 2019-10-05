const Endpoints = require('../../../resources/Endpoints');
const Utils = require('../../Utils.js');

const Friend = require('./Friend');

module.exports = class Friendship {
  constructor(communicator) {
    this.communicator = communicator;
    this.client = communicator.client;
  }

  /**
   * Accept or add a user with ID
   * @param {string} id - User ID or name to add
   */
  async addFriend(user) {
    const { id } = await this.client.lookup.accountLookup(user);
    if (!id) return false;

    const result = await this.client.requester.sendPost(
      `${Endpoints.FRIENDS}/${this.client.authenticator.accountId}/${id}`,
      `bearer ${this.client.authenticator.accessToken}`,
    );

    return result === undefined;
  }

  /**
   * Remove a friend with ID
   * @param {string} id - User ID or name to add
   */
  async removeFriend(user) {
    const { id } = await this.client.lookup.accountLookup(user);
    if (!id) return false;

    const result = await this.client.requester.sendDelete(
      `${Endpoints.FRIENDS}/${this.client.authenticator.accountId}/${id}`,
      `bearer ${this.client.authenticator.accessToken}`,
    );

    return result === undefined;
  }

  /**
   * Send a message to a logged in user
   * @param {JID|string} to - Who to send the chat message towards
   * @param {string} message - The message to send the user
   */
  async sendMessage(to, message) {
    const id = typeof to === 'string' ? (await this.client.lookup.accountLookup(to)).id : to;
    if (!id) return false;
    const user = typeof to === 'string' ? Utils.makeJID(id) : id;
    this.communicator.stream.sendMessage({
      to: user,
      type: 'chat',
      body: message,
    });
    return true;
  }
};
