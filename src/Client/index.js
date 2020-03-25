const Endpoints = require('../../resources/Endpoints');

const Requester = require('../Requester.js');
const Authenticator = require('./Authenticator.js');
const Lookup = require('./Lookup.js');
const Stats = require('./Stats.js');

module.exports = class Client {
  constructor(args = {}) {
    this.email = args.email || undefined;
    this.password = args.password || undefined;
    this.deviceAuth = args.deviceAuth || undefined;
    this.createNewDeviceAuth = args.createNewDeviceAuth || false,
    this.deleteOtherDeviceAuths = args.deleteOtherDeviceAuths || false;
    this.exchangeCode = args.exchangeCode || undefined;
    this.launcherToken = args.launcherToken || 'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=';
    this.fortniteToken = args.fortniteToken || 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=';
    this.iosToken = args.iosToken || 'MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3ZmI5YjA3NDg5ZDMxM2I0MWE='
    this.seasonStartTime = args.seasonStartTime || '1570990000'; // S11 EPOCH
    if ((!this.email || !this.password) && !this.deviceAuth && !this.exchangeCode) {
      throw new Error('Constructor data was incorrect: No auth method found. Please provide email and password, exchangecode or deviceauth data!');
    }
    this.autoKillSession = args.autokill !== undefined ? args.autokill : true;

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

    const status = await this.requester.sendGet(true, Endpoints.SERVER_STATUS, `bearer ${this.auths.accessToken}`);

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
    return this.requester.sendGet(false, `${Endpoints.BR_NEWS}?lang=${language}`, `bearer ${this.auths.accessToken}`);
  }

  /**
   * Get the current store of BR
   * @returns {object} JSON Object of the result
   */
  async getBRStore() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(true, Endpoints.BR_STORE, `bearer ${this.auths.accessToken}`);
  }

  /**
   * Get the current PVE Information
   * @returns {object} JSON Object of the result
   */
  async getPVEInfo() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(true, Endpoints.PVE_INFO, `bearer ${this.auths.accessToken}`);
  }

  /**
   * Get the current event flags of Battle Royale Mode
   * @returns {object} JSON Object of the result
   */
  async getBREventFlags() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(true, Endpoints.EVENT_FLAGS, `bearer ${this.auths.accessToken}`);
  }
};
