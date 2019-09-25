var config = require('./config.js');
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var db = mongoose.connect(config.db.db);

module.exports = db;