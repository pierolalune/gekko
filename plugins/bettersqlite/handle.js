var _ = require('lodash');
var fs = require('fs');

var util = require('../../core/util.js');
var config = util.getConfig();
var dirs = util.dirs();

var adapter = config.bettersqlite;

// verify the correct dependencies are installed
var pluginHelper = require(dirs.core + 'pluginUtil');
var pluginMock = {
  slug: 'better sqlite adapter',
  dependencies: adapter.dependencies,
};

var cannotLoad = pluginHelper.cannotLoad(pluginMock);
if (cannotLoad) util.die(cannotLoad);

// should be good now
var better_sqlite3 = require('better-sqlite3');

var plugins = require(util.dirs().gekko + 'plugins');

var version = adapter.version;

var dbName = config.watch.exchange.toLowerCase() + '_' + version + '.db';
var dir = dirs.gekko + adapter.dataDirectory;

var fullPath = [dir, dbName].join('/');

var mode = util.gekkoMode();
if (mode === 'realtime' || mode === 'importer') {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
} else if (mode === 'backtest') {
  if (!fs.existsSync(dir)) util.die('History directory does not exist.');

  if (!fs.existsSync(fullPath))
    util.die(
      `History database does not exist for exchange ${
        config.watch.exchange
      } at version ${version}.`
    );
}

module.exports = {
  initDB: () => {
    var journalMode = config.bettersqlite.journalMode || 'PERSIST';
    var syncMode = journalMode === 'WAL' ? 'NORMAL' : 'FULL';
  
    //if (config.debug) var db = new better_sqlite3(fullPath, { timeout: 10000, verbose: console.log });
    if (config.debug) var db = new better_sqlite3(fullPath, { timeout: 10000 });
    else var db = new better_sqlite3(fullPath, { timeout: 10000 });
    //db.run('PRAGMA synchronous = ' + syncMode);
    db.pragma('synchronous = ' + syncMode);
    //db.run('PRAGMA journal_mode = ' + journalMode);
    db.pragma('journal_mode = ' + journalMode);
    //db.configure('busyTimeout', 10000);
    return db;
  }
};
