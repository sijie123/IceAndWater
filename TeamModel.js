var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var TeamSchema = Schema({
  telegramID: Number,
  name: String,
  drStrangeID: Number,
  isPlayable: Boolean,
  code: String
})
var TeamModel = mongoose.model('Team', TeamSchema)

module.exports = {
  teamModel: TeamModel,
  teamSchema: TeamSchema
}

