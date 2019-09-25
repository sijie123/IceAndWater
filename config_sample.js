let config = {
  "BOT_TOKEN": "INSERT_BOT_TOKEN_HERE",
  "db": {
    "port": process.env.PORT || 2000,
  	"db": process.env.MONGOLAB_URI || "mongodb://user:pass@localhost/oravengers"
  },
}

module.exports = config;