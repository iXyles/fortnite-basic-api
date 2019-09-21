module.exports = Object.freeze({

  // NEW ENDPOINTS
  CSRF_TOKEN: 'https://www.epicgames.com/id/api/csrf',
  API_LOGIN: 'https://www.epicgames.com/id/api/login',
  API_EXCHANGE_CODE: 'https://www.epicgames.com/id/api/exchange',

  // LOGIN
  OAUTH_TOKEN: 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token',
  OAUTH_EXCHANGE: 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/exchange',
  OAUTH_KILL_SESSION: 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/sessions/kill',

  // ACCOUNT
  ACCOUNT: 'https://account-public-service-prod03.ol.epicgames.com/account/api/public/account',
  ACCOUNT_BY_NAME: 'https://account-public-service-prod03.ol.epicgames.com/account/api/public/account/displayName',

  // FN ENDPOINTS
  STATS_BR_V1: 'https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/stats/accountId',
  STATS_BR_V2: 'https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/statsv2/account',
  SERVER_STATUS: 'https://lightswitch-public-service-prod06.ol.epicgames.com/lightswitch/api/service/bulk/status?serviceId=Fortnite',

});
