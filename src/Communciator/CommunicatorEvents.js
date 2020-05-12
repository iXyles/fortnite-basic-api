/* eslint-disable no-nested-ternary */
const EventEmitter = require('events');

const FriendStatus = require('./Friend/FriendStatus.js');
const Status = require('./Friend/Status.js');
const Friend = require('./Friend/Friend.js');
const FriendMessage = require('./Friend/FriendMessage.js');

module.exports = class CommunicatorEvents extends EventEmitter {
  constructor(communicator) {
    super(); // Establish EventEmitter

    this.communicator = communicator;
    this.eventsRegistered = false;
  }

  /**
   * Setup listeners for events coming from the XMPP client
   */
  setupEvents() {
    if (this.eventsRegistered) return; // We already added them to this instance

    // connecting all the events
    this.communicator.stream.on('connected', this.onConnected.bind(this));
    this.communicator.stream.on('disconnected', this.onDisconnect.bind(this));
    this.communicator.stream.on('session:started', this.onSessionStart.bind(this));
    this.communicator.stream.on('session:end', this.onSessionEnd.bind(this));
    this.communicator.stream.on('presence', this.onPresenceUpdate.bind(this));
    this.communicator.stream.on('message', this.onStreamMessage.bind(this));

    this.communicator.client.authenticator.on('auths_updated', this.communicator.performRefreshLogin.bind(this.communicator));

    this.eventsRegistered = true;
  }

  /**
   * Fire that the client has conncted (NOT FULLY ESTABLISHED!)
   */
  onConnected() {
    this.communicator.connected = true;
    this.emit('connected');
  }

  /**
   * Fire that the client disconnceted
   * if `reconnect` true, it will try to reconnect.
   */
  async onDisconnect() {
    this.communicator.connected = false;
    this.emit('disconnected');

    if (!this.communicator.reconnect) return;
    const check = await this.communicator.client.authenticator.checkToken();
    if (check.tokenValid) this.communicator.stream.connect();
    else if (!check.tokenValid) this.emit('reconnect', check);
  }

  /**
   * Fire that the current connection session is fully established
   */
  onSessionStart() {
    this.emit('session:started');

    this.communicator.updateStatus(this.communicator.title);
  }

  /**
   * Fire that the currrent session ended
   */
  onSessionEnd() {
    this.emit('session:ended');
  }

  /**
   * Update of a friends presence status updated
   * @param {object} data - object of incoming presence updatte of user
   */
  onPresenceUpdate(data) {
    try {
      if (data.from.startsWith(this.communicator.client.authenticator.accountId)) return;
      if (data.type === 'unavailable' && !data.delay) return; // should mean it was a failed presence (removed friend)

      const fromSplit = data.from.split('Fortnite:');
      const platform = Array.isArray(fromSplit) && fromSplit[1] ? fromSplit[1].substr(0, 3) : '';

      const friend = new Friend(this.communicator, {
        accountId: data.from.split('@')[0],
        friendStatus: FriendStatus.ACCEPTED, // since we got the presence
        presence: data.status,
        status: data.show === 'away'
          ? Status.AWAY
          : data.type === 'unavailable'
            ? Status.OFFLINE
            : data.status && JSON.parse(data.status).bIsPlaying
              ? Status.PLAYING
              : Status.ONLINE,
        platform
      });

      this.emit('friend:presence', friend);
      this.emit(`friend#${friend.accountId}:presence`, friend);
    } catch (ex) {
      // This should never happen and as of why it is an console.error
      // eslint-disable-next-line no-console
      console.error('[REPORT PLEASE] [fortnite-basic-api] [Communicator]', ex);
    }
  }

  /**
   * Handle a data stream message
   * @param {object} data - object of incoming data from stream
   */
  onStreamMessage(data) {
    try {
      const body = !data.type ? JSON.parse(data.body) : data;

      switch (body.type) {
        case 'chat':
          this.onChatStreamMessage(body);
          break;
        case 'FRIENDSHIP_REQUEST':
          this.onFriendRequestMessage(body);
          break;
        case 'FRIENDSHIP_REMOVE':
          this.onFriendRemoval(body);
          break;
        default: this.emit('unknowndatamessage', `None implemented data stream of type: ${body.type}`, body);
      }
    } catch (ex) {
      // This should never happen and as of why it is an console.error
      // eslint-disable-next-line no-console
      console.error('[REPORT PLEASE] [fortnite-basic-api] [Communicator]', ex);
    }
  }

  /**
   * On incoming chat message
   * @param {object} data - Incoming data of chat message from friend
   */
  onChatStreamMessage(data) {
    const message = new FriendMessage(this.communicator, {
      accountId: data.from.split('@')[0],
      friendStatus: FriendStatus.ACCEPTED,
      message: data.body,
    });

    this.emit('friend:message', message);
    this.emit(`friend#${message.accountId}:message`, message);
  }

  /**
   * On incoming friend request message
   * @param {object} data - Incoming data of friend request message
   */
  onFriendRequestMessage(data) {
    if (data.status === 'ACCEPTED') this.onFriendRequestAccepted(data);
    else this.onFriendRequest(data);
  }

  /**
   * On incoming friend request
   * @param {object} data - Incoming data of friend request
   */
  onFriendRequest(data) {
    const request = new Friend(this.communicator, {
      accountId: this.communicator.client.authenticator.accountId === data.from
        ? data.to
        : data.from,
      friendStatus: this.communicator.client.authenticator.accountId === data.from
        ? FriendStatus.OUTGOING
        : FriendStatus.INCOMING,
    });

    this.emit('friend:request', request);
    this.emit(`friend#${request.accountId}:request`, request);
  }

  /**
   * On incoming friend request message is "ACCEPTED"
   * @param {object} data - Incoming data of accepted friend request
   */
  onFriendRequestAccepted(data) {
    const friend = new Friend(this.communicator, {
      accountId: this.communicator.client.authenticator.accountId === data.from
        ? data.to
        : data.from,
      friendStatus: FriendStatus.ACCEPTED,
    });

    this.emit('friend:added', friend);
    this.emit(`friend#${friend.accountId}:added`, friend);
  }

  /**
   * On friend removal, either way
   * @param {object} data - Incoming data of friend removal
   */
  onFriendRemoval(data) {
    const friend = new Friend(this.communicator, {
      accountId: this.communicator.client.authenticator.accountId === data.from
        ? data.to
        : data.from,
      friendStatus: data.reason === 'ABORTED'
        ? FriendStatus.ABORTED
        : data.reason === 'REJECTED'
          ? FriendStatus.REJECTED
          : FriendStatus.REMOVED,
    });

    this.emit(friend.friendStatus === 'ABORTED'
      ? 'friend:abort'
      : friend.friendStatus === 'REJECTED'
        ? 'friend:reject'
        : 'friend:removed', friend);
    this.emit(friend.friendStatus === 'ABORTED'
      ? `friend#${friend.accountId}:abort`
      : friend.friendStatus === 'REJECTED'
        ? `friend#${friend.accountId}:reject`
        : `friend#${friend.accountId}:removed`, friend);
  }
};
