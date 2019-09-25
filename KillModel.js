var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var KillSchema = Schema({
  killer: String,
  player: String,
  sent: Boolean
}, { runSettersOnQuery: true });
var KillModel = mongoose.model('Kill', KillSchema)
module.exports = {
  killSchema: KillSchema,
  killModel: KillModel
}

