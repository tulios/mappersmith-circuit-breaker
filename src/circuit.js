var Utils = require('mappersmith').Utils;

function fromNow(secs) {
  return Date.now() + (secs * 1000);
}

/**
 * Circuit constructor
 * @param opts {Object}
 *    * sleepWindow: seconds the circuit stays open once it has passed the error threshold (default: 300)
 *    * volumeThreshold: number of requests within 1 minute before it calculates error rates (default: 10)
 *    * errorThreshold: exceeding this rate will open the circuit (default: 50, percentage value)
 *    * timeoutSeconds: seconds before the circuit times out (default: 1)
 *    * timeWindow: interval of time used to calculate error_rate (in seconds, default: 60)
 */
var Circuit = function(opts) {
  this.storage = {
    open: false,
    success: 0,
    failure: 0,
    circuitOpenedOrLastTestedTime: Date.now()
  };
  this.opts = Utils.extend({
    sleepWindow: 300,
    volumeThreshold: 10,
    errorThreshold: 50,
    timeoutSeconds: 1,
    timeWindow: 60
  }, opts);

  if (this.opts.sleepWindow < this.opts.timeWindow) {
    this.opts.sleepWindow = this.opts.timeWindow;
  }
}

Circuit.prototype = {

  run: function(request) {
    if (this.allowRequest()) {
      try {
        request();
        this.markSuccess();
      } catch(e) {
        this.markFailure();
        // fallback?
      }
    } else {
      if (this.isOpen()) this.storage.open = true;
      // fallback?
    }
  },

  allowRequest: function() {
    return !this.isOpen() || this.allowSingleTest();
  },

  isOpen: function() {
    if (this.storage.open) return true;
    if (this.isPassedVolumeThreashold() && this.isPassedRateThreashould()) return true;
    return false;
  },

  allowSingleTest: function() {
    var idleTime = this.storage.lastFailureTime + this.opts.sleepWindow;
    if (this.storage.open && Date.now() > idleTime) return true;
    return false;
  },

  isPassedVolumeThreashold: function() {
    var success = this.storage.success;
    var failure = this.storage.failure;
    var count = success + failure;
    return count > this.opts.volumeThreshold;
  },

  isPassedRateThreashould: function() {
    return this.errorRate() >= this.opts.errorThreshold;
  },

  errorRate: function() {
    var success = this.storage.success;
    var failure = this.storage.failure;
    var count = success + failure;
    if (count <= 0) return 0.0;
    return failure.toFixed(2) / count.toFixed(2) * 100;
  },

  markSuccess: function() {
    this.storage.success++;
    if (this.storage.open) {
      this.storage.open = false;
      this.reset();
    }
  },

  markFailure: function() {
    this.storage.lastFailureTime = Date.now();
    this.storage.failure++;
  },

  reset: function() {
    // cleanup metris?
  }

}

module.exports = Circuit;
