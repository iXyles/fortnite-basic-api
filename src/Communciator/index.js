const { createClient } = require('stanza');
const UUID = require('uuid/v4');

const Endpoints = require('../../resources/Endpoints');
const CommunicatorEvents = require('./CommunicatorEvents.js');

module.exports = class Communicator {
  constructor(client, args = {}) {
    this.events = new CommunicatorEvents(this);

    this.uuid = Communicator.generateUUID();
    this.client = client;
    this.resource = `V2:Fortnite:WIN::${this.uuid}`;

    // settings
    this.reconnect = args.reconnect || true;
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
        jid: `${this.client.auths.accountId}@${Endpoints.EPIC_PROD_ENV}`,
        host: Endpoints.EPIC_PROD_ENV,
        username: this.client.auths.accountId,
        password: this.client.auths.accessToken,
      },
    });

    this.stream.enableKeepAlive({
      interval: 60,
    });
  }

  /**
   * Update the AgentConfig of the XMPP client
   * @param {objectt} opts - new configurations if needed
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
   */
  async connect() {
    if (!this.client.auths.accessToken) return { error: 'Cannot connect before LOGIN has been performed.' };
    if (!this.stream) this.setup();
    this.events.setupEvents();
    this.stream.connect();
    return { success: 'Starting connection towards XMPP Server.' };
  }

  /**
   * Generate a UUID
   * @return {string} String uppercase GUID without "-" inside of it.
   */
  static generateUUID() {
    return UUID().replace(/-/g, '').toUpperCase();
  }
};
