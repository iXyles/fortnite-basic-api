const Endpoints = require('../../../resources/Endpoints');
const Utils = require('../../Utils.js');

module.exports = class Friendship {
  constructor(communicator) {
    this.communicator = communicator;
    this.client = communicator.client;
  }

  /**
   * Accept or add a user with ID
   * @param {string} id - GUID of the user to add
   */
  async addFriend(id) {
    const result = await this.client.requester.sendPost(
      `${Endpoints.FRIENDS}/${this.client.authenticator.accountId}/${id}`,
      `bearer ${this.client.authenticator.accessToken}`,
    );

    return result === 'undefined' || (result && result.error === 'undefined');
  }

  /**
   * Remove a friend with ID
   * @param {string} id - GUID of the user to remove
   */
  async removeFriend(id) {
    const result = await this.client.requester.sendDelete(
      `${Endpoints.FRIENDS}/${this.client.authenticator.accountId}/${id}`,
      `bearer ${this.client.authenticator.accessToken}`,
    );

    return result === 'undefined' || (result && result.error === 'undefined');
  }

  /**
   * Send a message to a logged in user
   * @param {JID|string} to - Who to send the chat message towards
   * @param {string} message - The message to send the user
   */
  sendMessage(to, message) {
    const user = typeof to === 'string' ? Utils.makeJID(to) : to;
    this.communicator.stream.sendMessage({
      to: user,
      type: 'chat',
      body: message,
    });
  }
};
