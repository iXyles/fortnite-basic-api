# fortnite-basic-api
Basic Fortnite API for stats and server status built with async/await

Inspired by other repos about Fortnite API's as:

- https://github.com/SzymonLisowiec/node-epicgames-client

- https://github.com/qlaffont/fortnite-api

Which I previously used fortnite-api but have gotten issues with unhandledrejections which causing issues in other projects. Therefore I rebuilt with focus on Async/await to resolve the issues and adding support for V2 API endpoint.

Example usage: 
```
const { Client } = require('fortnite-basic-api');

// Creation of the Client
const client = new Client({
  email: '',
  password: '',
  launcherToken: 'MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3ZmI5YjA3NDg5ZDMxM2I0MWE=',
  fortniteToken: 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=',
});

// Example of usage
(async () => {
  console.log(await client.login());

  const parallel = await Promise.all([
    // Supports both name & id
    client.getV1Stats('iXyles'),
    client.getV1Stats('96afefcb12e14e7fa1bcfab1189eae55'),

    // Supports both name & id
    client.getV2Stats('iXyles'),
    client.getV2Stats('96afefcb12e14e7fa1bcfab1189eae55'),

    client.getServerStatus(),
    client.getBRNews('en'), // insert a different language code if wanted
    client.getBRStore(),
    client.getPVEInfo(),
    client.getBREventFlags(),
  ]);

  (parallel).forEach((result) => {
    console.log(result);
  });

  // Node will die and print that the session has been killed if login was successful
})();
```

# License
MIT License

Copyright (c) 2019 iXyles

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
