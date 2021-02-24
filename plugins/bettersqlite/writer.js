var _ = require('lodash');
var config = require('../../core/util.js').getConfig();

var sqlite = require('./handle');
var sqliteUtil = require('./util');
var util = require('../../core/util');
var log = require('../../core/log');

var Store = function(done, pluginMeta) {
  // Pierolalune, 17.02.2021: Prepare Bind all for lodash upgrade
  // _.bindAll(this);
  _.bindAll(this, _.functionsIn(this).sort());
  this.done = done;

  this.db = sqlite.initDB(false);
  //this.db.serialize(this.upsertTables);
  this.upsertTables();

  this.cache = [];
  this.buffered = util.gekkoMode() === "importer";
}

Store.prototype.upsertTables = function() {
  var createQueries = [
    `
      CREATE TABLE IF NOT EXISTS
      ${sqliteUtil.table('candles')} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start INTEGER UNIQUE,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        vwp REAL NOT NULL,
        volume REAL NOT NULL,
        trades INTEGER NOT NULL
      );
    `,

    // TODO: create trades
    // ``

    // TODO: create advices
    // ``
  ];

  var next = _.after(_.size(createQueries), this.done);

  _.each(
    createQueries, 
    _.bind(
      this.db.transaction(
        (q) => {
          this.db.prepare(q).run();
          next();
        }
      ), 
      this
    )
  );
}

Store.prototype.writeCandles = function() {
  if(_.isEmpty(this.cache))
    return;

  var stmt = this.db.prepare(`
      INSERT OR IGNORE INTO ${sqliteUtil.table('candles')}
      VALUES (?,?,?,?,?,?,?,?,?)
    `);

  const transaction = this.db.transaction((candles) => {
    for (const candle of candles) {
      stmt.run(null,
        candle.start.unix(),
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.vwp,
        candle.volume,
        candle.trades);
    }
    candles = [];
  });

    //stmt.finalize();
    //this.db.run("COMMIT");
    // TEMP: should fix https://forum.gekko.wizb.it/thread-57279-post-59194.html#pid59194
    //this.db.run("pragma wal_checkpoint;");

  transaction(this.cache);
  this.db.pragma('wal_checkpoint');
}

var processCandle = function(candle, done) {
  this.cache.push(candle);
  if (!this.buffered || this.cache.length > 1000) 
    this.writeCandles();

  done();
};

var finalize = function(done) {
  this.writeCandles();
  this.db.close(() => { done(); });
  this.db = null;
}

if(config.candleWriter.enabled) {
  Store.prototype.processCandle = processCandle;
  Store.prototype.finalize = finalize;
}

// TODO: add storing of trades / advice?

// var processTrades = function(candles) {
//   util.die('NOT IMPLEMENTED');
// }

// var processAdvice = function(candles) {
//   util.die('NOT IMPLEMENTED');
// }

// if(config.tradeWriter.enabled)
//  Store.prototype.processTrades = processTrades;

// if(config.adviceWriter.enabled)
//   Store.prototype.processAdvice = processAdvice;

module.exports = Store;
