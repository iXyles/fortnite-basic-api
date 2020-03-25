const exitHook = require('async-exit-hook');
const EventEmitter = require('events');

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
  async login(skipDeviceAuth = false) {
    let fnToken;

    if (this.client.deviceAuthOptions.createNew) {
      const deviceauth = await this.createDeviceAuth();
      if (deviceauth.error) return deviceauth;
    }

    if (this.client.deviceAuthDetails && !skipDeviceAuth) {
      const deviceAuthDetails = typeof this.client.deviceAuthDetails === 'function' ? await this.client.deviceAuthDetails() : this.client.deviceAuthDetails;
      if (!deviceAuthDetails || !deviceAuthDetails.secret) return this.login(true);
      const exchangeData = {
        grant_type: 'device_auth',
        account_id: deviceAuthDetails.accountId,
        device_id: deviceAuthDetails.deviceId,
        secret: deviceAuthDetails.secret,
      };

      fnToken = await this.client.requester.sendPost(false, Endpoints.OAUTH_TOKEN, `basic ${this.client.iosToken}`, exchangeData, { 'Content-Type': 'application/x-www-form-urlencoded' }, true);
      if (fnToken.error) return fnToken;

      if (this.client.deviceAuthOptions.deleteExisting) {
        const deleteOthers = await this.deleteAllDeviceAuths([deviceAuthDetails.deviceId], fnToken);
        if (deleteOthers.error) return deleteOthers;
      }
    } else {
      const launcherToken = await this.getOAuthToken();
      if (launcherToken.error) return launcherToken;

      // Use the redirect to set the bearer token for launcher requests
      this.client.requester.sendGet(false, 'https://www.epicgames.com/id/api/redirect',
        null,
        null,
        { Referer: 'https://www.epicgames.com/id/login' });

      const eula = await this.checkEULA(launcherToken);
      if (eula.error) return eula;
      if (!eula.accepted) {
        const eulaAccept = await this.acceptEULA(launcherToken, eula);
        if (!eulaAccept.accepted) return eulaAccept;
      }

      const exchange = await this.getOauthExchangeToken(launcherToken.access_token);
      if (exchange.error) return exchange;

      fnToken = await this.getFortniteOAuthToken(exchange);
      if (fnToken.error) return fnToken;
    }

    // Setup tokens from fnToken
    this.setAuthData(fnToken);

    // Setup kill hook for the session token - to prevent login issues on restarts
    if (this.client.autoKillSession && !this.killHook) {
      exitHook(async (callback) => {
        // eslint-disable-next-line no-console
        console.info(await this.killCurrentSession());
        callback();
      });
      this.killHook = true;
    }

    return { success: true }; // successful login
  }

  /**
   * This generates a new DeviceAuth and sets it as `client.deviceAuthDetails`.
   */
  async createDeviceAuth() {
    const launcherToken = await this.getOAuthToken(undefined, undefined, true);
    if (launcherToken.error) return { error: launcherToken.error };

    const deviceAuthDetails = await this.client.requester.sendPost(false, `${Endpoints.DEVICE_AUTH}/${launcherToken.account_id}/deviceAuth`, `bearer ${launcherToken.access_token}`);
    if (deviceAuthDetails.error) return { error: deviceAuthDetails.error };

    this.client.deviceAuthDetails = {
      deviceId: deviceAuthDetails.deviceId,
      accountId: deviceAuthDetails.accountId,
      secret: deviceAuthDetails.secret,
    };

    this.emit('device_auth_created', this.client.deviceAuthDetails);
    return { success: true };
  }

  /**
   * This deletes all deviceAuths.
   * @param {*} token AccessToken. Leave empty.
   * @param {*} dontDeleteIds Array of deviceIds you dont want to delete.
   */
  async deleteAllDeviceAuths(dontDeleteIds = [], accessToken) {
    const token = accessToken || this.accessToken;

    const existingDeviceAuths = await this.client.requester.sendGet(true, `${Endpoints.DEVICE_AUTH}/${token.account_id}/deviceAuth`, `bearer ${token.access_token}`);
    if (existingDeviceAuths.error) return { error: existingDeviceAuths.error };

    // eslint-disable-next-line consistent-return
    existingDeviceAuths.forEach(async (deviceAuth) => {
      if (!dontDeleteIds.includes(deviceAuth.deviceId)) {
        const deletedAuth = await this.client.requester.sendDelete(false, `${Endpoints.DEVICE_AUTH}/${token.account_id}/deviceAuth/${deviceAuth.deviceId}`, `bearer ${token.access_token}`);
        if (deletedAuth && deletedAuth.error) return { error: deletedAuth.error };
      }
    });
    return { success: true };
  }

  /**
   * Perform OAuth Exchange Token request
   * @param {string} token access_token from login data
   * @returns {object} JSON Object of result
   */
  async getOauthExchangeToken(token) {
    const res = await this.client.requester.sendGet(false, Endpoints.OAUTH_EXCHANGE, `bearer ${token}`);

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

    const res = await this.client.requester.sendPost(false, Endpoints.OAUTH_TOKEN, `basic ${this.client.fortniteToken}`, dataAuth, undefined, true);

    if (res.error || res.access_token) return res;
    return { error: `[getFortniteOAuthToken] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Perform login and get the OAuth token for the launcher
   * @returns {object} JSON Object of result
   */
  async getOAuthToken(twoStep = false, method, useIosToken = false) {
    await this.client.requester.sendGet(false, Endpoints.CSRF_TOKEN,
      undefined, undefined, undefined, false);
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

    const login = await this.client.requester.sendPost(false, Endpoints.API_LOGIN + (twoStep ? '/mfa' : ''),
      undefined, dataAuth, headers, true);

    if (login && login.error && login.error.errorCode === 'errors.com.epicgames.accountportal.session_invalidated') {
      return this.getOAuthToken();
    }

    if (login && login.error && login.error.metadata && login.error.metadata.twoFactorMethod) {
      return this.getOAuthToken(true, login.error.metadata.twoFactorMethod);
    }

    if (login && login.error) return login;

    const exchange = await this.client.requester.sendGet(false, Endpoints.API_EXCHANGE_CODE,
      undefined, undefined, { 'x-xsrf-token': this.xsrf.value }, false);

    const exchangeData = {
      grant_type: 'exchange_code',
      exchange_code: exchange.code,
      includePerms: true,
      token_type: 'eg1',
    };

    const res = await this.client.requester.sendPost(false, Endpoints.OAUTH_TOKEN, `basic ${useIosToken ? this.client.iosToken : this.client.launcherToken}`, exchangeData, headers, true);

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
        `basic ${this.client.fortniteToken}`, data, undefined, true);
      this.refreshing = false;
      this.emit('token_refresh', refresh);
    } else {
      try {
        refresh = await Utils.resolveEvent(this, 'token_refresh', 5000, s => s);
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

    const res = await this.client.requester.sendDelete(true, `${Endpoints.OAUTH_KILL_SESSION}/${this.accessToken}`, `bearer ${this.accessToken}`, {}, undefined, true);
    if (!res) return { success: '[fortnite-basic-api] Client session has been killed.' };
    if (res.error) return res;
    return { error: `[killCurrentSession] Unknown response from gateway ${Endpoints.OAUTH_TOKEN}` };
  }

  /**
   * Set auth data from login() or updateToken() input
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
    const owngame = this.entitlements.find(s => s.entitlementName === 'Fortnite_Free');
    if (!owngame) {
      const success = await this.purchaseFortnite(login);
      return success ? this.checkEULA(login) : { accepted: false, error: 'Purchase failed.' };
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
      `${Endpoints.CAPTCHA_PURCHASE}?namespace=${offer.lineOffers[0].namespace}&offers=${offer.lineOffers[0].offerId}`);

    const token = purchase.match(/<input(?:.*?)id=\"purchaseToken\"(?:.*)value=\"([^"]+).*>/)[1];

    return token && prepare.quickPurchaseStatus ? prepare.quickPurchaseStatus === 'CHECKOUT' : false;
  }
};
