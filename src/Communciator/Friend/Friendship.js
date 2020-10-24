/* eslint-disable no-nested-ternary */
const Endpoints = require('../../../resources/Endpoints');
const Utils = require('../../Utils.js');

const Friend = require('./Friend.js');
const FriendStatus = require('./FriendStatus.js');

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

    const result = await this.client.requester.sendPost(true,
      `${Endpoints.FRIENDS}/${this.client.authenticator.accountId}/${id}`,
      `bearer ${this.client.authenticator.accessToken}`);

    return result === undefined;
  }

  /**
   * Remove a friend with ID
   * @param {string} id - User ID or name to add
   */
  async removeFriend(user) {
    const { id } = await this.client.lookup.accountLookup(user);
    if (!id) return false;

    const result = await this.client.requester.sendDelete(true,
      `${Endpoints.FRIENDS}/${this.client.authenticator.accountId}/${id}`,
      `bearer ${this.client.authenticator.accessToken}`);

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

  /**
   * Returns raw data list of friends
   * @param {boolean} includePending true if you want get pending friends.
   */
  async getRawFriends(includePending) {
    try {
      const result = await this.client.requester.sendGet(true,
        `${Endpoints.FRIENDS}/${this.client.authenticator.accountId}?includePending=${!!includePending}`,
        `bearer ${this.client.authenticator.accessToken}`);

      if (result.error) return [];

      let friends = (Array.isArray(result) ? result : []).map((account) => ({
        accountId: account.accountId,
        friendStatus: account.status === FriendStatus.ACCEPTED
          ? FriendStatus.ACCEPTED
          : account.direction === 'INBOUND'
            ? FriendStatus.INCOMING
            : FriendStatus.OUTGOING,
        created: new Date(account.created),
        favorite: account.favorite,
      }));
      const ids = friends.map((friend) => friend.accountId);
      if (ids.length === 0) return [];
      const profiles = {};

      const requestProfiles = await this.client.lookup.accountLookup(ids);
      if (!requestProfiles.error) {
        requestProfiles.forEach((profile) => {
          profiles[profile.id] = {
            displayName: profile.displayName,
            externalAuths: profile.externalAuths,
          };
        });
      }
      
      friends = friends.map((friend) => {
        if (profiles[friend.accountId]) return Object.assign(friend, profiles[friend.accountId]);
        return null;
      }).filter((friend) => friend); // filter removes null values from array of friends.

      return friends;
    } catch (err) {
      // This should never happen and as of why it is an console.error
      // eslint-disable-next-line no-console
      console.error('[REPORT PLEASE] [fortnite-basic-api] [Friendship]', err);
    }

    return [];
  }

  /**
   * Get all incoming friend requests
   * @return {array} array of incoming all friend requests (FriendStatus.INCOMING)
   */
  async getIncomingFriendRequests() {
    const raw = await this.getRawFriends(true);
    const friends = raw.map((friend) => new Friend(this.communicator, friend));

    return friends ? friends.filter((friend) => friend.friendStatus === FriendStatus.INCOMING) : [];
  }

  /**
   * Get all outgoing friend requests
   * @return {array} array of all outgoing friend requests (FriendStatus.OUTGOING)
   */
  async getOutgoingFriendRequests() {
    const raw = await this.getRawFriends(true);
    const friends = raw.map((friend) => new Friend(this.communicator, friend));

    return friends ? friends.filter((friend) => friend.friendStatus === FriendStatus.OUTGOING) : [];
  }

  /**
   * Get all friends
   * @return {array} array of all friends (FriendStatus.ACCEPTED)
   */
  async getFriends() {
    const raw = await this.getRawFriends(false);
    const friends = raw.map((friend) => new Friend(this.communicator, friend));

    return friends ? friends.filter((friend) => friend.friendStatus === FriendStatus.ACCEPTED) : [];
  }
};
