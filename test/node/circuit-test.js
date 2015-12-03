require('./test-helper');
var Circuit = require('../../src/circuit');

describe('Circuit', function() {
  var circuit;

  describe('configs', function() {
    it('forces sleepWindow to be equal to timeWindow if it is too short', function() {
      circuit = new Circuit({sleepWindow: 1, timeWindow: 10});
      expect(circuit.opts.sleepWindow).to.equal(circuit.opts.timeWindow);
    });
  });

  describe('error ratio', function() {
    beforeEach(function() {
      circuit = new Circuit({
        sleepWindow: 300,
        volumeThreshold: 5,
        errorThreshold: 33,
        timeoutSeconds: 1
      });
    });

    it('opens the circuit on 100% failure', function() {
      var runCounter = 0;
      for (var i = 0; i < 10; i++) {
        circuit.run(function() {
          runCounter += 1;
          throw new Error('request failure');
        });
      }

      // the circuit should open after 6 failures
      // volumeThreshold 6 > 5 and 100% error rate
      expect(runCounter).to.equal(6);
    });

    it('keeps the circuit closed on 0% failure', function() {
      var runCounter = 0;
      for (var i = 0; i < 10; i++) {
        circuit.run(function() {
          runCounter += 1;
          'success'
        });
      }

      expect(runCounter).to.equal(10);
    });

    it('keeps the circuit open even after 1 success', function() {
      var runCounter = 0;
      for (var i = 0; i < 6; i++) {
        circuit.run(function() {
          runCounter += 1;
          throw new Error('request failure');
        });
      }

      circuit.run(function() { 'success' });
      expect(circuit.storage.failure).to.equal(6);
      expect(runCounter).to.equal(6);

      for (var i = 0; i < 6; i++) {
        circuit.run(function() {
          runCounter += 1;
          throw new Error('request failure');
        });
      }

      // the circuit did not closed after 1 success
      expect(runCounter).to.equal(6);
    });

    it('keeps circuit closed when failure ratio do not exceed limit', function() {
      var runCounter = 0;
      for (var i = 0; i < 7; i++) {
        circuit.run(function() {
          runCounter += 1;
          'success'
        });
      }

      expect(circuit.storage.failure).to.equal(0);

      for (var i = 0; i < 3; i++) {
        circuit.run(function() {
          runCounter += 1;
          throw new Error('request failure');
        });
      }

      // "run" executed 10 times because error rate didn't passed the
      // configured errorThreshold (33%)
      expect(runCounter).to.equal(10);
      expect(circuit.errorRate()).to.be.below(33);
    });

    it('opens the circuit when failure ratio exceed limit', function() {
      var runCounter = 0;
      for (var i = 0; i < 10; i++) {
        circuit.run(function() {
          runCounter += 1;
          'success'
        });
      }

      expect(circuit.storage.failure).to.equal(0);

      for (var i = 0; i < 10; i++) {
        circuit.run(function() {
          runCounter += 1;
          throw new Error('request failure');
        });
      }

      // 5 failures on 15º run is 33%
      expect(runCounter).to.equal(15);
      expect(circuit.errorRate()).to.be.at.least(33);
    });
  });

  describe('recovery through single test', function() {
    var runCounter;

    beforeEach(function() {
      circuit = new Circuit({
        sleepWindow: 10,
        volumeThreshold: 2,
        errorThreshold: 25,
        timeoutSeconds: 1
      });

      runCounter = 0;
      for (var i = 0; i < 3; i++) {
        circuit.run(function() {
          runCounter += 1;
          throw new Error('request failure');
        });
      }

      expect(circuit.storage.open).to.equal(true);
      expect(runCounter).to.equal(3);

      circuit.run(function() {
        runCounter += 1;
        'success'
      });

      // in sleep window, will remain open and not accept calls
      expect(runCounter).to.equal(3);

      // after the sleep time
      var now = Date.now();
      circuit.storage.lastFailureTime = now - (circuit.opts.sleepWindow + 1);
    });

    it('closes the circuit if the test succeeds', function() {
      circuit.run(function() {
        runCounter += 1;
        'success'
      });

      // after the sleep window accepts new requests
      expect(runCounter).to.equal(4);
      expect(circuit.storage.open).to.equal(false);
    });

    it('keeps the circuit open if the test fail', function() {
      circuit.run(function() {
        runCounter += 1;
        throw new Error('request failure');
      });

      // after the sleep window accepts new requests
      expect(runCounter).to.equal(4);
      expect(circuit.storage.open).to.equal(true);
    });
  });
});
