const readline = require('readline');

/**
 * Checks if `value` is a valid username.
 * @param {string} value The parameter to validate
 * @returns {boolean} `true | false`
 */
module.exports.isDisplayName = value => value && typeof value === 'string' && value.length >= 3 && value.length <= 16;

module.exports.consolePrompt = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}