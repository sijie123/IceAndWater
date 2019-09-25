var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var teamSchema = require('./TeamModel.js').teamSchema;
var gameSchema = require('./GameModel.js').gameSchema;

var PlayerSchema = Schema({
  telegramUser: {
    id: Number,
    firstName: String,
    lastName: String,
    username: String,
    photo: String
  },
  state: {
    status: String,
    role: String,
    kills: Number,
    team: teamSchema,
    isDrStrange: Boolean,
    killedBy: String
  },
  game: gameSchema
}, { runSettersOnQuery: true });
var PlayerModel = mongoose.model('Player', PlayerSchema)
module.exports = {
  playerSchema: PlayerSchema,
  playerModel: PlayerModel
}

