const Endpoints = require('../../resources/Endpoints');

const Requester = require('../Requester.js');
const Authenticator = require('./Authenticator.js');
const Lookup = require('./Lookup.js');
const Stats = require('./Stats.js');
const Utils = require('../Utils.js');

module.exports = class Client {
  constructor(args = {}) {
    this.email = args.email || undefined;
    this.password = args.password || undefined;
    this.useDeviceAuth = args.useDeviceAuth || false;
    this.deviceAuthPath = args.deviceAuthPath || './fbadeviceauths.json';
    this.removeOldDeviceAuths = args.removeOldDeviceAuths || false;
    this.launcherToken = args.launcherToken || 'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=';
    this.fortniteToken = args.fortniteToken || 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=';
    this.iosToken = args.iosToken || 'MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3ZmI5YjA3NDg5ZDMxM2I0MWE=';
    this.seasonStartTime = args.seasonStartTime || '1582185600'; // S12 (Chapter 2 Season 2) EPOCH
    if (!this.email || (!this.password && !this.useDeviceAuth)
      || !this.launcherToken || !this.fortniteToken || !this.iosToken) {
      throw new Error('Constructor data was incorrect [email, password, launcherToken, fortniteToken, iosToken] check docs.');
    }
    this.autoKillSession = args.autokill !== undefined ? args.autokill : true;

    this.requester = new Requester(this);
    this.authenticator = new Authenticator(this);
    this.lookup = new Lookup(this);
    this.stats = new Stats(this);
  }

  /**
   * Creates and saves a device auth
   * Must perform login afterwards
   */
  async createDeviceAuthFromExchangeCode() {
    const code = await Utils.consolePrompt('To generate device auth, please provide an exchange code: ');
    await this.requester.sendGet(false, Endpoints.CSRF_TOKEN);
    const xsrf = this.requester.jar.getCookies(Endpoints.CSRF_TOKEN).find((x) => x.key === 'XSRF-TOKEN');
    if (!xsrf) return { error: 'Failed querying CSRF endpoint with a valid response of XSRF-TOKEN' };

    const headers = {
      'x-xsrf-token': xsrf.value,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const exchangeData = {
      grant_type: 'exchange_code',
      exchange_code: code,
      includePerms: true,
      token_type: 'eg1',
    };

    const res = await this.requester.sendPost(false, Endpoints.OAUTH_TOKEN,
      `basic ${this.iosToken}`, exchangeData, headers, true);
    if (res.error) return res;

    const create = this.authenticator.createDeviceAuthWithExchange(res);
    return create; // The result of the creation
  }

  /**
   * Check the server status of Fortnite
   * @returns {boolean} `true | false`
   */
  async getServerStatus() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    const status = await this.requester.sendGet(true, Endpoints.SERVER_STATUS, `bearer ${this.authenticator.accessToken}`);

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
    return this.requester.sendGet(false, `${Endpoints.BR_NEWS}?lang=${language}`, `bearer ${this.authenticator.accessToken}`);
  }

  /**
   * Get the current store of BR
   * @returns {object} JSON Object of the result
   */
  async getBRStore() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(true, Endpoints.BR_STORE, `bearer ${this.authenticator.accessToken}`);
  }

  /**
   * Get the current PVE Information
   * @returns {object} JSON Object of the result
   */
  async getPVEInfo() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(true, Endpoints.PVE_INFO, `bearer ${this.authenticator.accessToken}`);
  }

  /**
   * Get the current event flags of Battle Royale Mode
   * @returns {object} JSON Object of the result
   */
  async getBREventFlags() {
    const check = await this.authenticator.checkToken();
    if (!check.tokenValid) return check;

    return this.requester.sendGet(true, Endpoints.EVENT_FLAGS, `bearer ${this.authenticator.accessToken}`);
  }
};
