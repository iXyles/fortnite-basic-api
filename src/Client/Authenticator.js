const exitHook = require('async-exit-hook');
const EventEmitter = require('events');
const fsp = require('fs').promises;

const Endpoints = require('../../resources/Endpoints');
const Utils = require('../Utils.js');

module.exports = class Authenticator extends EventEmitter {
  constructor(client) {
    super();

    this.client = client;
    this.killHook = false;
    this.refreshing = false;
  }

  /**
   * Perform the login process of the `Client`
   * @return {object} JSON Object of login result
   */
  async login() {
    const token = this.client.useDeviceAuth
      ? await this.getTokenWithDeviceAuth()
      : await this.getTokenWithLoginCreds();

    if (token.error) return token;

    this.setAuthData(token); // Set authdata
    this.setupAutoKill(); // Check & Setup autokill session

    if (this.deviceId && this.client.removeOldDeviceAuths) {
      const killAuths = await this.killDeviceAuths();
      if (!killAuths.success) return killAuths;
    }

    return { success: true }; // successful login
  }

  /**
   * Get login tokens by device auth
   * @returns {object} JSON Object of result
   */
  async getTokenWithDeviceAuth() {
    const auths = await this.readDeviceAuth();
    if (auths[this.client.email]) {
      const latest = auths[this.client.email][auths[this.client.email].length - 1];
      this.deviceId = latest.deviceId;
      this.deviceAccountId = latest.accountId;
      this.deviceSecret = latest.secret;
    }

    if (!this.deviceId || !this.deviceAccountId || !this.deviceSecret) {
      const create = await this.createSessionDeviceAuth();
      if (create.error) return create;
    }

    const exchangeData = {
      grant_type: 'device_auth',
      account_id: this.deviceAccountId,
      device_id: this.deviceId,
      secret: this.deviceSecret,
    };

    const token = await this.client.requester.sendPost(false, Endpoints.OAUTH_TOKEN,
      `basic ${this.client.iosToken}`, exchangeData, { 'Content-Type': 'application/x-www-form-urlencoded' }, true);
    if (token.error) return token;

    return token;
  }

  /**
   * Get login tokens by regular user credentials
   * @returns {object} JSON Object of result
   */
  async getTokenWithLoginCreds() {
    const launcherToken = await this.getOAuthToken();
    if (launcherToken.error) return launcherToken;

    // TODO: Check that this works with a new account or else fix it
    const eula = await this.checkEULA(launcherToken);
    if (eula.error) return eula;
    if (!eula.accepted) {
      const eulaAccept = await this.acceptEULA(launcherToken, eula);
      if (!eulaAccept.accepted) return eulaAccept;
    }

    const exchange = await this.getOAuthExchangeToken(launcherToken.access_token);
    if (exchange.error) return exchange;

    const token = await this.getFortniteOAuthToken(exchange);
    return token;
  }

  /**
   * Check if autokill shall be added and if it should
   * attach the killhook which will kill the current logged in session
   */
  setupAutoKill() {
    if (this.client.autoKillSession && !this.killHook) {
      exitHook(async (callback) => {
        // eslint-disable-next-line no-console
        console.info(await this.killCurrentSession());
        callback();
      });
      this.killHook = true;
    }
  }

  /**
   * Generate a new DeviceAuth and set it to the current session
   */
  async createSessionDeviceAuth() {
    const token = await this.getOAuthToken(false, '', true);
    if (token.error) return { success: false, error: token.error };

    return this.createDeviceAuthWithExchange(token);
  }

  /**
   * Generate a new DeviceAuth and set it to the current session
   */
  async createDeviceAuthWithExchange(token) {
    const deviceAuthDetails = await this.client.requester.sendPost(false,
      `${Endpoints.DEVICE_AUTH}/${token.account_id}/deviceAuth`, `bearer ${token.access_token}`);
    if (deviceAuthDetails.error) return { success: false, error: deviceAuthDetails.error };

    this.deviceId = deviceAuthDetails.deviceId;
    this.deviceAccountId = deviceAuthDetails.accountId;
    this.deviceSecret = deviceAuthDetails.secret;

    const saved = await this.saveDeviceAuth();
    if (!saved.success) return saved;

    return { success: true };
  }

  /**
   * Save the generate device auth to file
   * @returns {object} JSON Object of result
   */
  async saveDeviceAuth() {
    if (!this.client.email) return { success: false, error: 'No email set to client.' };
    if (!this.deviceId) return { success: false, error: 'No available device id set to authenticator.' };
    if (!this.deviceAccountId) return { success: false, error: 'No device account id set to authenticator.' };
    if (!this.deviceSecret) return { success: false, error: 'No device secret set to authenticator.' };

    const data = await this.readDeviceAuth();
    if (typeof data[this.client.email] === 'undefined') Object.assign(data, { [this.client.email]: [] });
    data[this.client.email].push({
      deviceId: this.deviceId,
      accountId: this.deviceAccountId,
      secret: this.deviceSecret,
    });

    await fsp.writeFile(this.client.deviceAuthPath, JSON.stringify(data));

    return { success: true };
  }

  /**
   * Read and return the saved device auths
   * @returns {object} JSON Object of result
   */
  async readDeviceAuth() {
    try {
      const filedata = await fsp.readFile(this.client.deviceAuthPath);
      const result = JSON.parse(filedata);
      return result;
    } catch (err) {
      return {};
    }
  }

  /**
   * Read previous auths and delete the requested ones from file
   */
  async removeDeviceAuths(remove) {
    const previous = await this.readDeviceAuth();
    if (previous[this.client.email]) {
      remove.forEach((key) => {
        if (key.deviceId === this.deviceId) return;
        previous[this.client.email] = previous[this.client.email]
          .filter((p) => p.deviceId === key.deviceId);
      });
    }
  }

  /**
   * Revoke deviceAuths of logged in account except for the current session one
   * @returns {object} JSON Object of result
   */
  async killDeviceAuths() {
    const existingDeviceAuths = await this.client.requester.sendGet(true,
      `${Endpoints.DEVICE_AUTH}/${this.accountId}/deviceAuth`, `bearer ${this.accessToken}`);
    if (existingDeviceAuths.error) return { success: false, error: existingDeviceAuths.error };

    const errors = [];
    existingDeviceAuths.forEach(async (key) => {
      if (key.deviceId === this.deviceId) return false;
      const deletedAuth = await this.client.requester.sendDelete(false,
        `${Endpoints.DEVICE_AUTH}/${this.accountId}/deviceAuth/${key.deviceId}`, `bearer ${this.accessToken}`);
      // something failed, add it to an error array for the user to see
      if (deletedAuth && deletedAuth.error) errors.push(deletedAuth.error);
      return !(deletedAuth && deletedAuth.error);
    });

    await this.removeDeviceAuths(existingDeviceAuths);

    // erorrs are for in-case someone are interested of errors that was made by manual call
    return { success: true, errors };
  }

  /**
   * Perform OAuth Exchange Token request
   * @param {string} token access_token from login data
   * @returns {object} JSON Object of result
   */
  async getOAuthExchangeToken(token) {
    const res = await this.client.requester.sendGet(false, Endpoints.OAUTH_EXCHANGE, `bearer ${token}`);

    if (res.error || res.code) return res;
    return { error: `[getOAuthExchangeToken] Unknown response from gateway ${Endpoints.OAUTH_EXCHANGE}` };
  }

  /**
   * Get OAuth Token for Fortnite Game access
   * @param {string} exchange Token from getOAuthExchangeToken()
   * @returns {object} JSON Object of result
   */
  async getFortniteOAuthToken(exchange) {
    const dataAuth = {
      grant_type: 'exchange_code',
      exchange_code: exchange.code,
      includePerms: true,
      token_type: 'eg1',
    };

    const res = await this.client.requester.sendPost(false, Endpoints.OAUTH_TOKEN, `basic ${this.client.fortniteToken}`, dataAuth, undefined, true);

    if (res.error || res.access_token) return res;
    return { error: `[getFortniteOAuthToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Perform login and get the OAuth token for the launcher
   * @returns {object} JSON Object of result
   */
  async getOAuthToken(twoStep = false, method, useIosToken = false) {
    const rep = await this.client.requester.sendGet(false, Endpoints.API_REPUTATION);
    if (!rep || (rep && rep.verdict && rep.verdict !== 'allow')) {
      return { error: `[getOAuthToken] Cannot proceed login because CAPTCHA rate limit: ${rep.verdict}` };
    }

    await this.client.requester.sendGet(false, Endpoints.CSRF_TOKEN);
    this.xsrf = this.client.requester.jar.getCookies(Endpoints.CSRF_TOKEN).find((x) => x.key === 'XSRF-TOKEN');

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

    const login = await this.client.requester.sendPost(false, Endpoints.API_LOGIN + (twoStep ? '/mfa' : ''),
      undefined, dataAuth, headers, true);

    if (login && login.error && login.error.errorCode === 'errors.com.epicgames.accountportal.session_invalidated') {
      return this.getOAuthToken();
    }

    if (login && login.error && login.error.metadata && login.error.metadata.twoFactorMethod) {
      return this.getOAuthToken(true, login.error.metadata.twoFactorMethod);
    }

    if (login && login.error) return login;

    const exchange = await this.client.requester.sendPost(false, Endpoints.API_EXCHANGE_CODE,
      undefined, undefined, { 'x-xsrf-token': this.xsrf.value }, false);

    const exchangeData = {
      grant_type: 'exchange_code',
      exchange_code: exchange.code,
      includePerms: true,
      token_type: 'eg1',
    };

    const res = await this.client.requester.sendPost(false, Endpoints.OAUTH_TOKEN,
      `basic ${useIosToken ? this.client.iosToken : this.client.launcherToken}`,
      exchangeData, headers, true);

    if (res.error || res.access_token) return res;
    return { error: `[getOAuthToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Check if the current token has expired or not
   * If it has expired it will force a `updateToken()`
   * @returns {object} JSON Object of result `tokenValid, error(optional)`
   */
  async checkToken() {
    if (!this.accessToken) return { tokenValid: false, error: 'No accessToken set' };

    const actualDate = new Date(); // Now
    const expireDate = new Date(new Date(this.expiresAt).getTime() - 15 * 60000);

    if (this.accessToken && this.expiresAt && expireDate < actualDate) {
      const refresh = await this.updateToken();
      if (refresh.error) return { tokenValid: false, error: 'Failed refreshing token on checkToken()' };
    }

    return { tokenValid: true }; // Token valid
  }

  /**
   * Refresh the accessToken of the `Client`
   * @returns {object} JSON Object of result
   */
  async updateToken() {
    if (!this.refreshToken) return { error: 'Cannot refresh the token due to no refreshToken set.' };

    // remove it so the "checkToken()" can validated
    // if it was successful or not if several requests are made.
    this.accessToken = undefined;

    const data = {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      includePerms: true,
    };

    let refresh;

    if (!this.refreshing) {
      this.refreshing = true;
      refresh = await this.client.requester.sendPost(false, Endpoints.OAUTH_TOKEN,
        `basic ${this.client.useDeviceAuth ? this.client.iosToken : this.client.fortniteToken}`, data, undefined, true);
      this.refreshing = false;
      this.emit('token_refresh', refresh);
    } else {
      try {
        refresh = await Utils.resolveEvent(this, 'token_refresh', 5000, (s) => s);
      } catch (err) { // should only happen in race condition
        if (this.accessToken) refresh = await this.checkToken();
        else refresh = { error: 'Token refresh failed, error unknown because of missed event fire' };
      }
    }

    if (refresh.error) return { success: false, error: refresh.error };
    if (refresh.access_token) {
      this.setAuthData(refresh); // Setup tokens from refresh
      return { success: true };
    }
    return { error: `[updateToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Kill the current running session of the `Client`
   * @returns {object} Object of result
   */
  async killCurrentSession() {
    if (!this.accessToken) return { error: 'Cannot kill the session due to no accessToken set.' };

    const res = await this.client.requester.sendDelete(true, `${Endpoints.OAUTH_KILL_SESSION}/${this.accessToken}`,
      `bearer ${this.accessToken}`, {}, undefined, true);

    if (!res) return { success: '[fortnite-basic-api] Client session has been killed.' };
    if (res.error) return res;
    return { error: `[killCurrentSession] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Set auth data from login() or updateToken() input
   * Emits the update to 'auths_updated' event
   */
  setAuthData(data) {
    this.expiresAt = data.expires_at;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.accountId = data.account_id;
    this.perms = data.perms;

    this.emit('auths_updated');
  }

  /**
   * Check EULA for Fortnite
   * @return {object} object with `accepted` of agreed or not
   * along result data if new agreement found and `accepted` is false
   */
  async checkEULA(login) {
    this.entitlements = await this.client.requester.sendGet(false,
      `${Endpoints.ENTITLEMENTS}/${login.account_id}/entitlements?start=0&count=5000`,
      `bearer ${login.access_token}`);

    const owngame = this.entitlements.find((s) => s.entitlementName === 'Fortnite_Free');
    if (!owngame) {
      return { accepted: false, error: 'You must purchase the game manually by logging in on the account.' };
    }

    const result = await this.client.requester.sendGet(false,
      `${Endpoints.EULA}/fn/account/${login.account_id}?locale=en`,
      `bearer ${login.access_token}`);
    if (result && result.error) {
      return result.error.errorCode === 'errors.com.epicgames.eulatracking.agreement_not_found'
        ? { accepted: true }
        : { accepted: false };
    }
    return !result ? { accepted: true } : { accepted: false, ...result };
  }

  /**
   * Accept a new EULA agreement
   * @param {object} eula of new agreement that needs to be accepted
   * @param {boolean} if agreement was sucessfully accepted or not
   */
  async acceptEULA(login, eula) {
    const result = await this.client.requester.sendPost(false,
      `${Endpoints.EULA}/${eula.key}/version/${eula.version}/account/${login.account_id}/accept?locale=en`,
      `bearer ${login.access_token}`);
    return result === undefined ? { accepted: true } : { accepted: false, ...result };
  }

  /**
   * [BROKEN]
   * Purchase fortnite game for free
   * @return {boolean} if purchase was successful or not
   */
  async purchaseFortnite(login) {
    const offer = {
      salesChannel: 'Launcher-purchase-client',
      entitlementSource: 'Launcher-purchase-client',
      returnSplitPaymentItems: false,
      lineOffers: [{
        offerId: '09176f4ff7564bbbb499bbe20bd6348f', // id of Fortnite in store
        quantity: 1,
        namespace: 'fn', // the namespace for purchasing fortnite
      }],
    };

    const prepare = await this.client.requester.sendPost(false,
      `${Endpoints.ORDER_PURCHASE}/${login.account_id}/orders/quickPurchase`,
      `bearer ${login.access_token}`,
      offer);

    if (prepare.quickPurchaseStatus !== 'CHECKOUT') return false; // something went wrong.

    const purchase = await this.client.requester.sendGet(false,
      `${Endpoints.CAPTCHA_PURCHASE}?namespace=${offer.lineOffers[0].namespace}&offers=${offer.lineOffers[0].offerId}#/purchase/verify?_k=jk77oe`);

    // eslint is lying regarding this row, but this does not work anyhow
    // eslint-disable-next-line no-useless-escape
    const token = purchase.match(/<input(?:.*?)id=\"purchaseToken\"(?:.*)value=\"([^"]+).*>/)[1];

    return token && prepare.quickPurchaseStatus ? prepare.quickPurchaseStatus === 'CHECKOUT' : false;
  }
};
