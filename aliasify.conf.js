var conf = {};

if (process.env.NODE_ENV === 'test') {
  conf = {
    verbose: true,
    aliases: {
      'mappersmith-circuit-breaker': './index.js'
    }
  }
}

module.exports = conf;
