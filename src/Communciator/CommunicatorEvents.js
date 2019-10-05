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
   * Wait and resolve for a specific event
   * @param {string} event - Which event to wait for
   * @param {number} time - Maximum waiting time
   * @param {expression} filter - Expression to filter incoming events on
   */
  resolveEvent(event, time, filter) {
    const timeout = typeof time === 'number' ? time : 5000;
    return new Promise((resolve, reject) => {
      this.on(event, (...args) => {
        if (filter && !filter(...args)) return;
        resolve(...args);
      });
      setTimeout(() => reject(new Error(`Waiting for communicator event timeout exceeded: ${timeout} ms`)), timeout);
    });
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

    this.communicator.client.authenticator.on('auths_updated', this.communicator.performRefreshLogin.bind(this));

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
  onDisconnect() {
    this.communicator.connected = false;
    this.emit('disconnected');
    if (this.reconnect) this.stream.connect();
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
      if (data.type === 'unavailable' && !data.delay) return;

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
      });

      this.emit('friend:presence', friend);
      this.emit(`friend#${friend.accountId}:presence`, friend);
    } catch (ex) {
      console.error(ex);
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
      console.error(ex);
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
      accountId: data.to,
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
      accountId: data.to,
      friendStatus: FriendStatus.REMOVED,
    });

    this.emit(data.reason === 'ABORTED' ? 'friend:abort' : 'friend:removed', friend);
    this.emit(data.reason === 'ABORTED' ? `friend#${friend.accountId}:abort` : `friend#${friend.accountId}:removed`, friend);
  }
};
