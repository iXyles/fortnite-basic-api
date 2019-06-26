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

  async send(method, url, auth, data, headers, form) {
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

  async sendGet(url, auth, data, headers, form) {
    return this.send('GET', url, auth, data, headers, form);
  }

  async sendPost(url, auth, data, headers, form) {
    return this.send('POST', url, auth, data, headers, form);
  }

  async sendDelete(url, auth, data, headers, form) {
    return this.send('DELETE', url, auth, data, headers, form);
  }
};
