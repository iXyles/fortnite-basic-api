const { createClient } = require('stanza');

const Endpoints = require('../../resources/Endpoints');
const CommunicatorEvents = require('./CommunicatorEvents.js');
const Friendship = require('./Friend/Friendship.js');
const Utils = require('../Utils.js');

module.exports = class Communicator {
  constructor(client, args = {}) {
    this.client = client;

    this.events = new CommunicatorEvents(this);
    this.friendship = new Friendship(this);

    this.connected = false;
    this.uuid = Utils.generateUUID();
    this.resource = `V2:Fortnite:WIN::${this.uuid}`;

    // settings
    this.reconnect = args.reconnect || true;
    this.title = args.title || 'Online';
  }

  /**
   * Prepare and setup the client before a connect
   */
  setup() {
    this.stream = createClient({
      server: Endpoints.EPIC_PROD_ENV,
      transports: {
        websocket: `wss://${Endpoints.XMPP_SERVER}`,
        bosh: false,
      },

      credentials: {
        jid: `${this.client.authenticator.accountId}@${Endpoints.EPIC_PROD_ENV}`,
        host: Endpoints.EPIC_PROD_ENV,
        username: this.client.authenticator.accountId,
        password: this.client.authenticator.accessToken,
      },

      resource: this.resource, // to make it seen online INSIDE the game.
    });

    this.stream.enableKeepAlive({
      interval: 60,
    });
  }

  /**
   * Update the AgentConfig of the XMPP client
   * @param {object} opts - new configurations if needed
   */
  updateConfigs(opts) {
    const currConfig = this.stream.config;
    this.stream.config = {
      ...currConfig,
      ...opts,
    };
  }

  /**
   * Perform the connect towards XMPP Server
   * @return {object} object with error or success data.
   */
  async connect() {
    if (!this.client.authenticator.accessToken) return { error: 'Cannot connect before LOGIN has been performed.' };
    if (!this.stream) this.setup();
    this.events.setupEvents();
    this.stream.connect();
    return { success: 'Starting connection towards XMPP Server.' };
  }

  /**
   * Sending request for presence.
   * @param {JID|string} to - who to send it to
   */
  async sendProbe(to) {
    const user = typeof to === 'string' ? Utils.makeJID(to) : to;
    return this.stream.sendPresence({
      to: user,
      type: 'probe',
    });
  }

  /**
   * Update the current logged in account presence status
   * @param {object|string} status - Presence to update to
   */
  async updateStatus(status) {
    if (!status) return this.stream.sendPresence(null); // if null we reset it
    return this.stream.sendPresence({
      Status: JSON.stringify(typeof status === 'object'
        ? status
        : {
          Status: status,
          bIsPlaying: false,
          bIsJoinable: false,
          bHasVoiceSupport: false,
          SessionId: '',
          Properties: {},
        }),
    });
  }

  /**
   * Update client configurations and relog
   * Used to update the current streams token to be up to date
   */
  performRefreshLogin() {
    this.uuid = Utils.generateUUID();
    this.resource = `V2:Fortnite:WIN::${this.uuid}`;
    this.updateConfigs({
      credentials: {
        jid: `${this.client.authenticator.accountId}@${Endpoints.EPIC_PROD_ENV}`,
        host: Endpoints.EPIC_PROD_ENV,
        username: this.client.authenticator.accountId,
        password: this.client.authenticator.accessToken,
      },
    });
    if (this.connected) this.stream.disconnect();
    else this.stream.connect();
  }
};
