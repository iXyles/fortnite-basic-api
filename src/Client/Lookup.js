const Endpoints = require('../../resources/Endpoints');
const Utils = require('../Utils.js');

module.exports = class Lookup {
  constructor(client) {
    this.client = client;
  }

  /**
   * Retrieve account data information
   * @param {string|object|array} user JSON of an already lookedup account,
   * username of the account or the userId
   * array of usernames or ids
   * @returns {object} JSON Object of the result `id, displayName, externalAuths` OR `error`
   */
  async accountLookup(account) {
    if (account.error) return account;
    if (account.externalAuths) return account;
    if (Utils.isDisplayName(account)) return this.lookupByUsername(account);
    if (account instanceof Array) return this.lookupByUserIds(account);
    return this.lookupByUserId(account);
  }

  /**
   * Gets a users userId and performs "lookupByUserId()"
   * @param {string} username Name of the user to lookup
   * @returns {object} JSON Object of the result `id, displayName, externalAuths` OR `error`
   */
  async lookupByUsername(username) {
    const check = await this.client.authenticator.checkToken();
    if (!check.tokenValid) return check;

    const account = await this.client.requester.sendGet(true, `${Endpoints.ACCOUNT_BY_NAME}/${encodeURI(username)}`, `bearer ${this.client.authenticator.accessToken}`);

    if (account.error) return account;
    if (!account.id) return { error: 'No username with the name could be found.' };
    return this.lookupByUserId(account.id);
  }

  /**
   * Lookup a user by userId
   * @param {string} accountId Id of the account to lookup
   * @returns {object} JSON Object of the result `id, displayName, externalAuths` OR `error`
   */
  async lookupByUserId(accountId) {
    const check = await this.client.authenticator.checkToken();
    if (!check.tokenValid) return check;

    const account = await this.client.requester.sendGet(true, `${Endpoints.ACCOUNT}?accountId=${accountId}`, `bearer ${this.client.authenticator.accessToken}`);

    if (account.error) return account;
    if (account.length === 0) return { error: 'No username with the name could be found.' };
    return account[0];
  }

  /**
   * Lookup a user by userIds
   * @param {array} accountIds of accounts to look up
   * @returns {object} JSON Object of the result `id, displayName, externalAuths` OR `error`
   */
  async lookupByUserIds(accountIds) {
    const check = await this.client.authenticator.checkToken();
    if (!check.tokenValid) return check;

    const chunk = 100;
    let i; let j; const requests = [];

    for (let u = accountIds.length - 1; u >= 0; u -= 1) {
      if (Utils.isDisplayName(accountIds[u])) {
        requests.push(this.client.requester.sendGet(true, `${Endpoints.ACCOUNT_BY_NAME}/${encodeURI(accountIds[u])}`, `bearer ${this.client.authenticator.accessToken}`));
        accountIds.splice(u, 1);
      }
    }

    for (i = 0, j = accountIds.length; i < j; i += chunk) {
      const temp = accountIds.slice(i, i + chunk);
      requests.push(this.client.requester.sendGet(true, `${Endpoints.ACCOUNT}?accountId=${temp.join('&accountId=')}`, `bearer ${this.client.authenticator.accessToken}`));
    }

    const parallel = await Promise.all(requests);
    let accounts = [];
    Object.keys(parallel).forEach((result) => accounts.push(parallel[result]));

    if (Array.prototype.flat) {
      accounts = accounts.flat(1);
    } else {
      accounts = Utils.flat(accounts);
    }

    if (accounts.error) return accounts;
    if (accounts.length === 0) return { error: 'No usernames with the ids could be found.' };
    return accounts;
  }
};
