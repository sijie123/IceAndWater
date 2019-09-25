var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var teamSchema = require('./TeamModel.js').teamSchema;

var GameSchema = Schema({
  main: teamSchema,
  moderator: teamSchema,
  teams: [teamSchema],
  code: String,
  started: Boolean
}, { runSettersOnQuery: true });

var GameModel = mongoose.model('Game', GameSchema)
module.exports = {
  gameSchema: GameSchema,
  gameModel: GameModel
}
