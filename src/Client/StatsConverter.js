const Utils = require('../Utils.js');

module.exports = class Converter {
  /**
   * Converts the data from epics stats endpoint V2
   * to a more readable format and grouping the stats accordingly
   * gamemode 'creative_playonly' and 'playground' is not
   * @param {object} data The JSON data from the API Endpoint of V2
   * @returns {object} JSON Object of the converted data
   */
  static convertV2(data) {
    const { stats } = data;
    const result = {};

    // less iterations
    const allStats = {};
    const modes = {}; // to track found game modes, incase they update the API.
    const allVariables = {}; // to track all variables

    Object.keys(stats).forEach((key) => {
      const parts = Utils.stringSplit(key, '_', 5);

      if (parts[0] !== 'br') return; // safty check

      const varName = parts[1];
      const inputType = parts[2];
      const gamemode = parts[5];

      this.extractData(result, modes, allVariables,
        allStats, gamemode, varName, stats[key], inputType);
    });

    this.parseStats(result, allStats, allVariables, modes);

    return result;
  }

  /**
   * Extract data from the found row into maps for later usage in
   * parsing the stats and calculating extra stats
   * @param {object} result The JSON Object to store the data to
   * @param {object} modes JSON Object to store all game modes in
   * @param {object} variables JSON Object to store the key of all variables
   * @param {object} allStats JSON Object to store all "values" to
   * @param {string} gamemode The current Gamemode that shall be parsed
   * @param {string} varName The current Variable that is being parsed
   * @param {number} value The value of the parsed Variable
   * @param {string} input Platform/Input type (depending on V1/V2 stats)
   */
  static extractData(result, modes, variables, allStats, gamemode, varName, value, input) {
    Object.assign(modes, { [gamemode]: true }); // map because of "unique names"
    Object.assign(variables, { [varName]: true }); // map because of "unique names"

    // setup objects
    if (typeof result[input] === 'undefined') Object.assign(result, { [input]: {} });
    if (typeof result[input][gamemode] === 'undefined') Object.assign(result[input], { [gamemode]: {} });
    if (typeof allStats[gamemode] === 'undefined') Object.assign(allStats, { [gamemode]: {} });

    Object.assign(result[input][gamemode], { [varName]: value });
    if (varName !== 'lastmodified' || !allStats[gamemode][varName]) {
      Object.assign(allStats[gamemode], {
        [varName]: (allStats[gamemode][varName] || 0) + (value || 0),
      });
    } else if (allStats[gamemode][varName] && value > allStats[gamemode][varName]) {
      Object.assign(allStats[gamemode], {
        [varName]: value || 0,
      });
    }
  }

  /**
   * Groups stats into modes and adds extra values such as
   * kdr, winrate, killsPerMatch and an 'all' stats object
   * for both platform/input and of them all
   * @param {object} result The JSON Object to store the data to
   * @param {object} allStats JSON Object to store all "values" to & use
   * @param {object} allVariables JSON Object of all variables
   * @param {object} modes JSON Object of all found game modes
   */
  static parseStats(result, allStats, allVariables, modes) {
    Object.assign(result, { all: allStats });

    Object.keys(result).forEach((input) => {
      Object.assign(result[input], { all: {} });

      Object.keys(allVariables).forEach((variable) => {
        let value = 0;
        Object.keys(modes).forEach((mode) => {
          if (mode === 'playground' || mode === 'creative_playonly') return;

          if (result[input][mode] && result[input][mode][variable]) {
            if (variable !== 'lastmodified') value += result[input][mode][variable];
            else if (result[input][mode][variable] > value) {
              value = result[input][mode][variable];
            }
          }
        });
        Object.assign(result[input].all, { [variable]: value });
      });

      Object.keys(result[input]).forEach((mode) => {
        this.assignExtraStats(result[input][mode]);
      });
    });
  }

  /**
   * Assign `winrate, kdr, killsPerMatch` to the `obj` input
   * @param {object} obj The JSON Objec that shall be used for assigning
   * the extra variables to the object.
   */
  static assignExtraStats(obj) {
    if (!obj.placetop1) Object.assign(obj, { placetop1: 0 });
    if (!obj.kills) Object.assign(obj, { kills: 0 });
    const winrate = Number(this.winrate(obj.placetop1, obj.matchesplayed));
    const kdr = Number(this.ratio(obj.kills, obj.matchesplayed - obj.placetop1));
    const killsPerMatch = Number(this.ratio(obj.kills, obj.matchesplayed));
    Object.assign(obj, { winrate, kdr, killsPerMatch });
  }

  /**
   * Calculate the KD ratio of kills / games
   * @param {string|number} a Amount of kills
   * @param {string|number} b Amount of games
   * @returns {number} Returns KD of (kills/games)
   * OR if 0 games it will return the amount of kills (2 decimals)
   */
  static ratio(a, b) {
    if (Number.parseInt(b, 10) === 0) return Number.parseInt(a, 10).toFixed(2);
    return (Number.parseInt(a, 10) / Number.parseInt(b, 10)).toFixed(2);
  }

  /**
   * Calculates the WIN ratio of (wins/games)
   * @param {string|number} a The amount of won games
   * @param {string|number} b The amount of total played games
   * @returns {number} The win rate % with 2 decimals
   */
  static winrate(a, b) {
    if (Number.parseInt(b, 10) === 0) return 0;
    return ((Number.parseInt(a, 10) / Number.parseInt(b, 10)) * 100).toFixed(2);
  }
};
