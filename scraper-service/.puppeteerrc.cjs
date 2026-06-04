const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to the local project directory
  // so Render doesn't lose it between builds.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
