const Request = require('request-promise');

module.exports = class Requester {
  constructor(client) {
    this.client = client;
    this.jar = Request.jar();

    this.options = {
      timeout: 5000,
      headers: { },
      json: true,
      jar: this.jar,
    };

    this.request = Request.defaults(this.options);
  }

  async send(checkToken, method, url, auth, data, headers, form) {
    if (checkToken) {
      const check = await this.client.authenticator.checkToken();
      if (!check.tokenValid) return check;
    }
    try {
      const options = {
        ...this.options,
        url,
      };

      options.method = method;

      if (auth) {
        options.headers.Authorization = auth;
      }

      if (data) {
        if (form) {
          options.headers['Content-Type'] = 'application/json';
          options.form = data;
        } else options.body = data;
      }

      if (typeof headers === 'object') options.headers = { ...options.headers, ...headers };

      return await this.request(options);
    } catch (error) {
      return { error: error.error };
    }
  }

  async sendGet(tokenCheck, url, auth, data, headers, form) {
    return this.send(tokenCheck, 'GET', url, auth, data, headers, form);
  }

  async sendPost(tokenCheck, url, auth, data, headers, form) {
    return this.send(tokenCheck, 'POST', url, auth, data, headers, form);
  }

  async sendDelete(tokenCheck, url, auth, data, headers, form) {
    return this.send(tokenCheck, 'DELETE', url, auth, data, headers, form);
  }
};
