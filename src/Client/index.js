const Endpoints = require('../../resources/Endpoints');

const Requester = require('../Requester.js');
const Authenticator = require('./Authenticator.js');
const Lookup = require('./Lookup.js');
const Stats = require('./Stats.js');

module.exports = class Client {
  constructor(args = {}) {
    this.email = args.email || undefined;
    this.password = args.password || undefined;
    this.launcherToken = args.launcherToken || undefined;
    this.fortniteToken = args.fortniteToken || undefined;
    this.seasonStartTime = args.seasonStartTime || '1564657200'; // S10 EPOCH
    if (!this.email || !this.password || !this.launcherToken || !this.fortniteToken) {
      throw new Error('Constructor data was incorrect [email, password, launcherToken, fortniteToken] check docs.');
    }

    this.requester = new Requester(this);
    this.authenticator = new Authenticator(this);
    this.lookup = new Lookup(this);
    this.stats = new Stats(this);

    // To keep backwards compability for old version (to a certain degree)
    // Authentications
    this.login = async () => this.authenticator.login();
    this.auths = this.authenticator;

    // Stats
    this.getV1Stats = async user => this.stats.getV1Stats(user);
    this.getV2Stats = async user => this.stats.getV2Stats(user);

    // Lookups
    this.accountLookup = async account => this.lookup.accountLookup(account);
  }

  /**
   * Check the server status of Fortnite
   * @returns {boolean} `true | false`
   */
  async getServerStatus() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    const status = await this.requester.sendGet(Endpoints.SERVER_STATUS, `bearer ${this.auths.accessToken}`);

    return (status && status[0] && status[0].status && status[0].status === 'UP');
  }

  /**
   * No auth required
   * Get the current store of BR
   * @param {string} language for result (fr, de, es, zh, it, ja, en)
   * default language is set to english
   * @returns {object} JSON Object of the result
   */
  async getBRNews(language = 'en') {
    return this.requester.sendGet(`${Endpoints.BR_NEWS}?lang=${language}`, `bearer ${this.auths.accessToken}`);
  }

  /**
   * Get the current store of BR
   * @returns {object} JSON Object of the result
   */
  async getBRStore() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(Endpoints.BR_STORE, `bearer ${this.auths.accessToken}`);
  }

  /**
   * Get the current PVE Information
   * @returns {object} JSON Object of the result
   */
  async getPVEInfo() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(Endpoints.PVE_INFO, `bearer ${this.auths.accessToken}`);
  }

  /**
   * Get the current event flags of Battle Royale Mode
   * @returns {object} JSON Object of the result
   */
  async getBREventFlags() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(Endpoints.EVENT_FLAGS, `bearer ${this.auths.accessToken}`);
  }
};
