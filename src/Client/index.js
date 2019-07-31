const exitHook = require('async-exit-hook');

const Endpoints = require('../../resources/Endpoints');
const Requester = require('../Requester.js');

const Converter = require('../Converter');

module.exports = class Client {
  constructor(args) {
    this.email = args.email || undefined;
    this.password = args.password || undefined;
    this.launcherToken = args.launcherToken || undefined;
    this.fortniteToken = args.fortniteToken || undefined;
    this.seasonStartTime = args.seasonStartTime || '1564657200'; // S10 EPOCH
    if (!this.email || !this.password || !this.launcherToken || !this.fortniteToken) {
      throw new Error('Constructor data was incorrect [email, password, launcherToken, fortniteToken] check docs.');
    }

    this.auths = {};
    this.requester = new Requester(this);
    this.killHook = false;
  }

  /**
   * Perform the login process of the `Client`
   * @return {object} JSON Object of login result
   */
  async login() {
    const token = await this.getOAuthToken();
    if (token.error) return token;

    const exchange = await this.getOauthExchangeToken(token.access_token);
    if (exchange.error) return exchange;

    const fnToken = await this.getFortniteOAuthToken(exchange);
    if (fnToken.error) return fnToken;

    // Setup tokens from fnToken
    this.setAuthData(fnToken);

    // Setup kill hook for the session token - to prevent login issues on restarts
    if (!this.killHook) {
      exitHook(async (callback) => {
        // eslint-disable-next-line no-console
        await console.info(await this.killCurrentSession());
        callback();
      });
      this.killHook = true;
    }

    return { success: true }; // successful login
  }

  /**
   * Set auth data from login() or refreshToken() input
   */
  setAuthData(data) {
    this.auths.expiresAt = data.expires_at;
    this.auths.accessToken = data.access_token;
    this.auths.refreshToken = data.refresh_token;
    this.auths.accountId = data.account_id;
  }

  /**
   * Get OAuth for from Epic Launcher
   * @returns {object} JSON Object of result
   */
  async getOAuthToken() {
    const dataAuth = {
      grant_type: 'password',
      username: this.email,
      password: this.password,
      includePerms: true,
    };

    const res = await this.requester.sendPost(Endpoints.OAUTH_TOKEN, `basic ${this.launcherToken}`, dataAuth, undefined, true);

    if (res.error || res.access_token) return res;
    return { error: `[getOAuthToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Perform OAuth Exchange Token request
   * @param {string} token access_token from login data
   * @returns {object} JSON Object of result
   */
  async getOauthExchangeToken(token) {
    const res = await this.requester.sendGet(Endpoints.OAUTH_EXCHANGE, `bearer ${token}`);

    if (res.error || res.code) return res;
    return { error: `[getOauthExchangeToken] Unknown response from gateway ${Endpoints.OAUTH_EXCHANGE}` };
  }

  /**
   * Get OAuth Token for Fortnite Game access
   * @param {string} exchange Token from getOauthExchangeToken()
   * @returns {object} JSON Object of result
   */
  async getFortniteOAuthToken(exchange) {
    const dataAuth = {
      grant_type: 'exchange_code',
      exchange_code: exchange.code,
      includePerms: true,
      token_type: 'eg1',
    };

    const res = await this.requester.sendPost(Endpoints.OAUTH_TOKEN, `basic ${this.fortniteToken}`, dataAuth, undefined, true);

    if (res.error || res.access_token) return res;
    return { error: `[getFortniteOAuthToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Check if the current token has expired or not
   * If it has expired it will force a `refreshToken()`
   * @returns {object} JSON Object of result `tokenValid, error(optional)`
   */
  async checkToken() {
    if (!this.auths.accessToken) return { tokenValid: false, error: 'No accessToken set' };

    const actualDate = new Date(); // Now
    const expireDate = new Date(new Date(this.auths.expiresAt).getTime() - 15 * 60000);

    if (this.auths.accessToken && this.auths.expiresAt && expireDate < actualDate) {
      const refresh = await this.refreshToken();
      if (refresh.error) return { tokenValid: false, error: 'Failed refreshing token on checkToken()' };
    }

    return { tokenValid: true }; // Token valid
  }

  /**
   * Refresh the accessToken of the `Client`
   * @returns {object} JSON Object of result
   */
  async refreshToken() {
    if (!this.auths.refreshToken) return { error: 'Cannot refresh the token due to no refreshToken set.' };

    // remove it so the "checkToken()" can validated
    // if it was successful or not if several requests are made.
    this.auths.accessToken = undefined;

    const data = {
      grant_type: 'refresh_token',
      refresh_token: this.auths.refreshToken,
      includePerms: true,
    };

    const refresh = await this.requester.sendPost(Endpoints.OAUTH_TOKEN, `basic ${this.fortniteToken}`, data, undefined, true);

    if (refresh.error) return { success: false, error: refresh.error };
    if (refresh.access_token) {
      this.setAuthData(refresh); // Setup tokens from refresh
      return { success: true };
    }
    return { error: `[refreshToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Retrieve account data information
   * @param {string|object} user JSON of an already lookedup account,
   * username of the account or the userId
   * @returns {object} JSON Object of the result `id, accountName, externalAuths` OR `error`
   */
  async accountLookup(account) {
    if (account.error) return account;
    if (account.externalAuths) return account;
    if (Client.isDisplayName(account)) return this.lookupByUsername(account);
    return this.lookupByUserId(account);
  }

  /**
   * Gets a users userId and performs "lookupByUserId()"
   * @param {string} username Name of the user to lookup
   * @returns {object} JSON Object of the result `id, accountName, externalAuths` OR `error`
   */
  async lookupByUsername(username) {
    const check = await this.checkToken();
    if (!check.tokenValid) return check;

    const account = await this.requester.sendGet(`${Endpoints.ACCOUNT_BY_NAME}/${encodeURI(username)}`, `bearer ${this.auths.accessToken}`);

    if (account.error) return account;
    if (!account.id) return { error: 'No username with the name could be found.' };
    return this.lookupByUserId(account.id);
  }

  /**
   * Lookup a user by userId
   * @param {string} accountId Id of the account to lookup
   * @returns {object} JSON Object of the result `id, accountName, externalAuths` OR `error`
   */
  async lookupByUserId(accountId) {
    const check = await this.checkToken();
    if (!check.tokenValid) return check;

    const account = await this.requester.sendGet(`${Endpoints.ACCOUNT}?accountId=${accountId}`, `bearer ${this.auths.accessToken}`);

    if (account.error) return account;
    if (account.length === 0) return { error: 'No username with the name could be found.' };
    return account[0];
  }

  /**
   * Get stats from Epics V1 stats API
   * @param {string|object} user JSON of an already lookedup account,
   * username of the account or the userId
   * @returns {object} JSON Object of the result (parsed and converted)
   */
  async getV1Stats(user) {
    const check = await this.checkToken();
    if (!check.tokenValid) return check;

    const account = await this.accountLookup(user);
    if (account.error || !account.id) return { error: account.error || 'Cannot retrieve stats since the input account does not exist' };

    // Request all the stats
    const promises = [];
    promises.push(this.requester.sendGet(`${Endpoints.STATS_BR_V1}/${account.id}/bulk/window/alltime`, `bearer ${this.auths.accessToken}`));
    promises.push(this.requester.sendGet(`${Endpoints.STATS_BR_V1}/${account.id}/bulk/window/weekly`, `bearer ${this.auths.accessToken}`));
    const result = await Promise.all(promises);

    if (!result[0]) return { error: `Could not retrieve stats from user ${account.displayName}, because of private leaderboard settings.`, user: account };

    const lifetime = Converter.convertV1(result[0]);
    const season = Converter.convertV1(result[1]);

    return { lifetime, season, user: account };
  }

  /**
   * Get stats from Epics V2 stats API
   * @param {string|object} user JSON of an already lookedup account,
   * username of the account or the userId
   * @returns {object} JSON Object of the result (parsed and converted)
   */
  async getV2Stats(user) {
    const check = await this.checkToken();
    if (!check.tokenValid) return check;

    const account = await this.accountLookup(user);
    if (account.error || !account.id) return { error: account.error || 'Cannot retrieve stats since the input account does not exist' };

    // Request all the stats
    const promises = [];
    promises.push(this.requester.sendGet(`${Endpoints.STATS_BR_V2}/${account.id}`, `bearer ${this.auths.accessToken}`));
    promises.push(this.requester.sendGet(`${Endpoints.STATS_BR_V2}/${account.id}?startTime=${this.seasonStartTime}`, `bearer ${this.auths.accessToken}`));
    const result = await Promise.all(promises);

    if (!result[0]) return { error: `Could not retrieve stats from user ${account.displayName}, because of private leaderboard settings.`, user: account };

    const lifetime = Converter.convertV2(result[0]);
    const season = Converter.convertV2(result[1]);

    return { lifetime, season, user: account };
  }

  /**
   * Check the server status of Fortnite
   * @returns {boolean} `true | false`
   */
  async getServerStatus() {
    const check = await this.checkToken();
    if (!check.tokenValid) return check;

    const status = await this.requester.sendGet(Endpoints.SERVER_STATUS, `bearer ${this.auths.accessToken}`);

    return (status && status[0] && status[0].status && status[0].status === 'UP');
  }

  /**
   * Kill the current running session of the `Client`
   * @returns {object} Object of result
   */
  async killCurrentSession() {
    if (!this.auths.accessToken) return { error: 'Cannot kill the session due to no accessToken set.' };

    const res = await this.requester.sendDelete(`${Endpoints.OAUTH_KILL_SESSION}/${this.auths.accessToken}`, `bearer ${this.auths.accessToken}`, {}, undefined, true);
    if (!res) return { success: '[fortnite-basic-api] Client session has been killed.' };
    if (res.error) return res;
    return { error: `[killCurrentSession] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Checks if `value` is a valid username.
   * @param {string} value The parameter to validate
   * @returns {boolean} `true | false`
   */
  static isDisplayName(value) {
    return value && typeof value === 'string' && value.length >= 3 && value.length <= 16;
  }
};
