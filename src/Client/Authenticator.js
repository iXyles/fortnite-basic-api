const exitHook = require('async-exit-hook');
const EventEmitter = require('events');

const Endpoints = require('../../resources/Endpoints');
const Utils = require('../Utils.js');

module.exports = class Authenticator extends EventEmitter {
  constructor(client) {
    super();

    this.client = client;
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
   * Perform OAuth Exchange Token request
   * @param {string} token access_token from login data
   * @returns {object} JSON Object of result
   */
  async getOauthExchangeToken(token) {
    const res = await this.client.requester.sendGet(Endpoints.OAUTH_EXCHANGE, `bearer ${token}`);

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

    const res = await this.client.requester.sendPost(Endpoints.OAUTH_TOKEN, `basic ${this.client.fortniteToken}`, dataAuth, undefined, true);

    if (res.error || res.access_token) return res;
    return { error: `[getFortniteOAuthToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Perform login and get the OAuth token for the launcher
   * @returns {object} JSON Object of result
   */
  async getOAuthToken(twoStep = false, method) {
    await this.client.requester.sendGet(Endpoints.CSRF_TOKEN, undefined, undefined, undefined, false);
    this.xsrf = this.client.requester.jar.getCookies(Endpoints.CSRF_TOKEN).find(x => x.key === 'XSRF-TOKEN');

    if (!this.xsrf) return { error: 'Failed querying CSRF endpoint with a valid response of XSRF-TOKEN' };

    const headers = {
      'x-xsrf-token': this.xsrf.value,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const code = twoStep ? await Utils.consolePrompt('Two factor detected, write the 6 number code from 2FA: ') : '';

    const dataAuth = twoStep
      ? {
        code,
        method,
        rememberDevice: false,
      }
      : {
        email: this.client.email,
        password: this.client.password,
        rememberMe: true,
      };

    const login = await this.client.requester.sendPost(Endpoints.API_LOGIN + (twoStep ? '/mfa' : ''),
      undefined, dataAuth, headers, true);

    if (login && login.error && login.error.metadata && login.error.metadata.twoFactorMethod) {
      return this.getOAuthToken(true, login.error.metadata.twoFactorMethod);
    }

    if (login && login.error) return login;

    const exchange = await this.client.requester.sendGet(Endpoints.API_EXCHANGE_CODE,
      undefined, undefined, { 'x-xsrf-token': this.xsrf.value }, false);

    const exchangeData = {
      grant_type: 'exchange_code',
      exchange_code: exchange.code,
      includePerms: true,
      token_type: 'eg1',
    };

    const res = await this.client.requester.sendPost(Endpoints.OAUTH_TOKEN, `basic ${this.client.launcherToken}`, exchangeData, headers, true);

    if (res.error || res.access_token) return res;
    return { error: `[getOAuthToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Check if the current token has expired or not
   * If it has expired it will force a `refreshToken()`
   * @returns {object} JSON Object of result `tokenValid, error(optional)`
   */
  async checkToken() {
    if (!this.accessToken) return { tokenValid: false, error: 'No accessToken set' };

    const actualDate = new Date(); // Now
    const expireDate = new Date(new Date(this.expiresAt).getTime() - 15 * 60000);

    if (this.accessToken && this.expiresAt && expireDate < actualDate) {
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
    if (!this.refreshToken) return { error: 'Cannot refresh the token due to no refreshToken set.' };

    // remove it so the "checkToken()" can validated
    // if it was successful or not if several requests are made.
    this.accessToken = undefined;

    const data = {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      includePerms: true,
    };

    const refresh = await this.client.requester.sendPost(Endpoints.OAUTH_TOKEN, `basic ${this.client.fortniteToken}`, data, undefined, true);

    if (refresh.error) return { success: false, error: refresh.error };
    if (refresh.access_token) {
      this.setAuthData(refresh); // Setup tokens from refresh
      return { success: true };
    }
    return { error: `[refreshToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Kill the current running session of the `Client`
   * @returns {object} Object of result
   */
  async killCurrentSession() {
    if (!this.accessToken) return { error: 'Cannot kill the session due to no accessToken set.' };

    const res = await this.client.requester.sendDelete(`${Endpoints.OAUTH_KILL_SESSION}/${this.accessToken}`, `bearer ${this.accessToken}`, {}, undefined, true);
    if (!res) return { success: '[fortnite-basic-api] Client session has been killed.' };
    if (res.error) return res;
    return { error: `[killCurrentSession] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Set auth data from login() or refreshToken() input
   */
  setAuthData(data) {
    this.expiresAt = data.expires_at;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.accountId = data.account_id;

    this.emit('auths_updated');
  }
};
