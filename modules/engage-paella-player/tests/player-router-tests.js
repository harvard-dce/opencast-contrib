var test = require('tape');
var initPlayerRouter = require('../app-src/player-router/index');

// test('Pause', function pause(t) {
//   console.log('Enter `c()` in the console to continue.');
//   window.c = t.end;
// });

var positiveCases = [
  {
    seekParamName: 'range',
    hashLocation: 'range=10',
    expectedStart: 10,
    expectedEnd: undefined
  },
  {
    seekParamName: 'range',
    hashLocation: 'range=10-15',
    expectedStart: 10,
    expectedEnd: 15
  },
  {
    seekParamName: 't',
    hashLocation: 't=10',
    expectedStart: 10,
    expectedEnd: undefined
  },
  {
    seekParamName: 't',
    hashLocation: 't=10-900',
    expectedStart: 10,
    expectedEnd: 900
  },
  {
    seekParamName: 't',
    hashLocation: 'whatever/something/t=20',
    expectedStart: 20,
    expectedEnd: undefined
  },
  {
    seekParamName: 't',
    hashLocation: 'whatever/something/t=20-21',
    expectedStart: 20,
    expectedEnd: 21
  },
  {
    seekParamName: 'init',
    hashLocation: 'next=hello/init=801-ab3',
    expectedStart: 801,
    expectedEnd: undefined
  },
  {
    seekParamName: 'time',
    hashLocation: 'next=hello/time=801-800',
    expectedStart: 801,
    expectedEnd: undefined
  }
];

var negativeCases = [
  {
    seekParamName: 'range',
    hashLocation: ''
  },
  {
    seekParamName: 'range',
    hashLocation: 'nothingtodowithseek=50'
  },
  {
    seekParamName: 't',
    hashLocation: 's=10/something-after'
  },
  {
    seekParamName: 'range',
    hashLocation: 'range=abcd20'
  }
];

test('Direct route test', function directTest(t) {
  window.location.hash = 'st=101';

  var router = initPlayerRouter({
    seeking: {
      seekParamName: 'st',
      seekResponder: checkRouting
    }
  });

  router.route();

  function checkRouting(time) {
    t.equal(time, 101, 'Correct time is passed to responder.');
    t.end();
  }
});

negativeCases.forEach(runNegativeCaseTest);
positiveCases.forEach(runPositiveCaseTest);

function runPositiveCaseTest(testCase) {
  test('Positive test', function positiveTest(t) {
    initPlayerRouter({
      seeking: {
        seekParamName: testCase.seekParamName,
        seekResponder: checkRouting
      }
    });

    window.location.hash = testCase.hashLocation;

    function checkRouting(startTime, endTime) {
      t.equal(
        startTime,
        testCase.expectedStart,
        'Correct start is passed to responder.'
      );
      t.equal(
        endTime,
        testCase.expectedEnd,
        'Correct end is passed to responder.'
      );
      t.end();
    }
  });
}

function runNegativeCaseTest(testCase) {
  test('Negative test', function negativeTest(t) {
    initPlayerRouter({
      seeking: {
        seekParamName: testCase.seekParamName,
        seekResponder: checkRouting
      }
    });

    window.location.hash = testCase.hashLocation;

    setTimeout(pass, 0);

    function checkRouting() {
      t.fail('Does not call responder because hash does not contain param.');
    }

    function pass() {
      t.pass('Does not call responder because hash does not contain param.');
      t.end();
    }
  });
}
