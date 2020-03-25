const Endpoints = require('../../resources/Endpoints');
const Converter = require('./StatsConverter.js');

module.exports = class Stats {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get stats from Epics V2 stats API
   * @param {string|object} user JSON of an already lookedup account,
   * username of the account or the userId
   * @returns {object} JSON Object of the result (parsed and converted)
   */
  async getV2Stats(user) {
    const check = await this.client.authenticator.checkToken();
    if (!check.tokenValid) return check;

    const account = await this.client.lookup.accountLookup(user);
    if (account.error || !account.id) return { error: account.error || 'Cannot retrieve stats since the input account does not exist' };

    // Request all the stats
    const promises = [];
    promises.push(this.client.requester.sendGet(true, `${Endpoints.STATS_BR_V2}/${account.id}`, `bearer ${this.client.authenticator.accessToken}`));
    promises.push(this.client.requester.sendGet(true, `${Endpoints.STATS_BR_V2}/${account.id}?startTime=${this.client.seasonStartTime}`, `bearer ${this.client.authenticator.accessToken}`));
    const result = await Promise.all(promises);

    if (result === null || result === undefined) return { error: 'No stats could be retrieved, Fortnite stats might be offline or inaccessible' };
    if (!result[0]) return { error: `Could not retrieve stats from user ${account.displayName}, because of private leaderboard settings.`, user: account };

    const lifetime = Converter.convertV2(result[0]);
    const season = Converter.convertV2(result[1]);

    return { lifetime, season, user: account };
  }
};
