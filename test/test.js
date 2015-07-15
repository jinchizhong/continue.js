var assert = require('assert');
var Promise = require('promise');
var C = require('../lib/continue.js');

describe('self test', function () {
  it('1 == 1', function () {
    assert.equal(1, 1);
  });
});

var mock_callback = function() {
  var callback = arguments[arguments.length - 1];
  var args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
  setTimeout(function() {
    callback.apply(this, args);
  }, 1);
};

var mock_callback_1000 = function() {
  var callback = arguments[arguments.length - 1];
  var args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
  setTimeout(function() {
    callback.apply(this, args);
  }, 1000);
};

var mock_promise = function(s, val) {
  return new Promise(function(fullfil, reject) {
    setTimeout(function() {
      if (s) {
        fullfil(val);
      } else {
        reject(val);
      }
    }, 1);
  });
};

describe('continue.js', function () {
  it('basic chain', function(done) {
    C().then(function(c) {
      setTimeout(c, 10);
    }).stdend(done);
  });
  it('safe', function(done) {
    C('safe').then(function(c) {
      assert(c.opts.safe);
      throw 'test';
    }).fail(function(c) {
      assert.equal(c.lastErr, 'test');
      throw 'test2';
    }).fail(function(c) {
      assert.equal(c.lastErr, 'test2');
      c();
    }).stdend(done);
  });
  it('unsafe', function() {
    assert.throws(function () {
      C().then(function(c) {
        assert.not(c.opts.safe);
        throw 'test';
      }).end();
    });
  });
  it('unsafe 2', function() {
    assert.throws(function () {
      C().then(function(c) {
        c.reject();
      }).fail(function(c) {
        throw 'test';
      }).end();
    });
  });
  it('unsafe 3', function() {
    assert.throws(function () {
      C().then(function(c) {
        c();
      }).always(function(c) {
        throw 'test';
      }).end();
    });
  });
  it('.then(c, x, y)', function() {
    C().then(function(c) {
      c(123, 'hello');
    }).then(function(c, x, y) {
      assert.equal(x, 123);
      assert.equal(y, 'hello');
      assert.equal(c.lastErr, null);
      assert.equal(c.args[0], 123);
      assert.equal(c.args[1], 'hello');
    }).end();
  });
  it('.fail(c, x, y)', function() {
    C().then(function(c) {
      c.reject(123, 'hello');
    }).fail(function(c, x, y) {
      assert.equal(x, 123);
      assert.equal(y, 'hello');
      assert.equal(c.lastErr, 123);
      assert.equal(c.args[0], 123);
      assert.equal(c.args[1], 'hello');
    }).end();
  });
  it('.always(c, x, y)', function() {
    C().then(function(c) {
      c(123, 'hello');
    }).always(function(c, x, y) {
      assert.equal(x, 123);
      assert.equal(y, 'hello');
      assert.equal(c.lastErr, null);
      assert.equal(c.args[0], 123);
      assert.equal(c.args[1], 'hello');
    }).end();
  });
  it('.fail(c)', function() {
    C().then(function(c) {
      c.reject('test err');
    }).fail(function(c) {
      assert.equal(c.err, null);
      assert.equal(c.lastErr, 'test err');
      assert.equal(c.args[0], 'test err');
      assert.equal(c.args[1], undefined);
    }).end();
  });
  it('.always', function() {
    var times = 0;
    C().then(function(c) {
      c.accept();
    }).always(function(c) {
      assert.equal(c.lastErr, null);
      ++times;
      c.reject();
    }).always(function(c) {
      assert.notEqual(c.lastErr, null);
      ++times;
      c();
    }).then(function(c) {
      assert.equal(times, 2);
      c();
    }).end();
  });
  it('.last', function() {
    var x = 0;
    C().then(function(c) {
      c.accept();
    }).last(function(c) {
      assert.equal(c.lastErr, null);
      x = 1;
    });
    assert.equal(x, 1);
  });
  it('.last 2', function() {
    var x = 0;
    C().then(function(c) {
      c.reject();
    }).last(function(c) {
      assert.notEqual(c.lastErr, null);
      x = 1;
    });
    assert.equal(x, 1);
  });
  it('.end should throw', function() {
    assert.throws(function () {
      C().then(function(c) {
        c.reject();
      }).end();
    });
  });
  it('.end should throw 2', function() {
    assert.throws(function () {
      C().then(function(c) {
        c.reject();
      }).end(false);
    });
  });
  it('.end should not throw', function() {
    C().then(function(c) {
      c.reject();
    }).end(true);
  });
  it('.end assign', function() {
    C().then(function(c) {
      this.x = 1;
      this.y = {z: 'y.z'};
      c();
    }).end('x', 'y.z', function(a, b) {
      assert.equal(a, 1);
      assert.equal(b, 'y.z');
    });
  });
  it('.end assign $err', function() {
    C().then(function(c) {
      c.reject('test err');
    }).end(true, '$lastErr', function(err) {
      assert.equal(err, 'test err');
    });
  });
  it('.stdend do not allow missing callback', function() {
    assert.throws(function () {
      C().then(function(c) {
        c.reject();
      }).stdend();
    });
  });
  it('.stdend should not throw', function() {
    C().then(function(c) {
      c.reject();
    }).stdend(function(){});
  });
  it('.stdend assign', function() {
    C().then(function(c) {
      this.x = 1;
      this.y = {z: 'y.z'};
      c.reject('test');
    }).stdend('x', 'y.z', function(err, a, b) {
      assert.equal(err, 'test');
      assert.equal(a, 1);
      assert.equal(b, 'y.z');
    });
  });
  it('.toPromise fullfil', function() {
    var p = C().then(function(c) {
      c.accept(123);
    }).toPromise();
    p.then(function(v) {
      assert.equal(v, 123);
    });
  });
  it('.toPromise reject', function() {
    var p = C().then(function(c) {
      c.reject('test');
    }).toPromise();
    p.then(function(v) {
      throw 'not over here';
    }, function(err) {
      assert.equal(err, 'test');
    });
  });
  it('c(...)', function() {
    C().then(function(c) {
      c(123);
    }).always(function(c) {
      assert.equal(c.lastErr, null);
      assert.equal(c.args[0], 123);
      c.err = 'test error';
      c(234);
    }).always(function(c) {
      assert.equal(c.lastErr, 'test error');
      assert.equal(c.args[0], 234);
      assert.equal(c.err, null);
    }).end();
  });
  it('c.accept', function() {
    C().then(function(c) {
      this.err = 'test';
      c.accept(123);
    }).always(function(c) {
      assert.equal(c.lastErr, null);
      assert.equal(c.args[0], 123);
      c();
    }).end();
  });
  it('c.reject', function() {
    C().then(function(c) {
      c.reject('test');
    }).always(function(c) {
      assert.equal(c.lastErr, 'test');
      assert.equal(c.args[0], 'test');
      c.reject();
    }).always(function(c) {
      assert.notEqual(c.lastErr, 'test');
      c();
    }).end();
  });
  it('c.break', function() {
    C().then(function(c) {
      c.break('ohhhh');
    }).always(function(c) {
      throw 'not over here';
    }).last(function(c) {
      assert.equal(c.lastErr, null);
      assert.equal(c.args[0], 'ohhhh');
      assert(c.breaked);
    });
  });
  it('c.assign', function(done) {
    C().then(function(c) {
      mock_callback(1, 'aa', c.assign('x', 'y.z'));
    }).always(function(c) {
      assert.equal(c.lastErr, null);
      assert.equal(this.x, 1);
      assert.equal(this.y.z, 'aa');
      c();
    }).stdend(done);
  });
  it('c.assign $err', function(done) {
    C().then(function(c) {
      mock_callback('test err', c.assign('$err'));
    }).always(function(c) {
      assert.equal(c.lastErr, 'test err');
      c();
    }).stdend(done);
  });
  it('c.assign more then 10', function(done) {
    C().then(function(c) {
      mock_callback(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 
            c.assign('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12', 'a13'));
    }).always(function(c) {
      assert.equal(this.a13, 13);
      c();
    }).stdend(done);
  });
  it('c.assign simulate length', function() {
    C().then(function(c) {
      var args = [];
      for (var i = 0; i < 30; ++i) {
        assert.equal(c.assign.apply(this, args).length, i);
        args.push('a' + i);
      }
      c();
    }).end();
  });
  it('c.locals', function(done) {
    C().then(function(c) {
      assert.equal(c.locals, this);
      c();
    }).stdend(done);
  });
  it('c.reject.assign', function(done) {
    C().then(function(c) {
      c.reject.assign('err2')('test error');
    }).always(function(c) {
      assert.equal(c.lastErr, 'test error');
      assert.equal(this.err2, 'test error');
      c();
    }).stdend(done);
  });
  it('promise', function(done) {
    C().then(function(c) {
      mock_promise(true, 123).then(c.accept, c.reject);
    }).then(function(c, value) {
      assert.equal(value, 123);
      assert.equal(c.args[0], 123);
      mock_promise(false, 234).then(c.accept, c.reject);
    }).fail(function(c) {
      assert.equal(c.lastErr, 234);
      assert.equal(c.args[0], 234);
      mock_promise(true, 333).then(c.accept, c.reject);
    }).always(function(c) {
      assert.equal(c.lastErr, null);
      assert.equal(c.args[0], 333);
      mock_promise(true).then(c.accept, c.reject);
    }).stdend(done);
  });
  it('do not call c() twice', function() {
    assert.throws(function () {
      C().then(function(c) {
        c();
        c();
      }).std();
    });
  });
  it('.for array', function() {
    var x = '';
    C().for(['a', 'b', 'c'], function(c, i, v) {
      assert.equal(typeof i, 'number');
      x += v;
    }).then(function(c) {
      assert(x, 'abc');
    }).end();
  });
  it('.for object', function() {
    var ks = '';
    var vs = '';
    C().then(function(c) {
      this.x = {a: 1, b: 2, c: 3};
    }).for('x', function(c, k, v) {
      assert.equal(typeof i, 'string');
      ks += k;
      vs += v;
    }).then(function(c) {
      assert(ks, 'abc');
      assert(vs, '123');
    }).end();
  });
  it('.for break', function() {
    C().for(['a', 'b', 'c'], function(c, i, v) {
      this.times = this.times ? this.times + 1 : 1;
      c.break();
    }).always(function(c) {
      assert.equal(c.lastErr, null);
      assert.equal(this.times, 1);
      assert.equal(c.breaked, true);
      this.xxx = 1;
    }).last(function(c) {
      assert.equal(c.breaked, false);
      assert.equal(this.xxx, 1);
    });
  });
  it('.for parallel', function(done) {
    // if parallel succeed, this case will case 1000 ms
    // else it will be timeout
    C().for(10, ['a', 'b', 'c', 'd', 'e'], function(c, i, v) {
      mock_callback_1000(v, c.assign('x.' + i));
    }).then(function(c) {
      assert.equal(this.x.toArray().join(''), 'abcde');
      c();
    }).stdend(done);
  });
  it('.for empty', function(done) {
    C().for([], function(c, i, v) {
      throw 'not over here';
    }).stdend(done);
  });
  it('.then parallel', function(done) {
    var times = 0;
    C().then(function(c) {
      c(123);
    }).then(function(c, x) {
      assert.equal(x, 123);
      ++times;
      setTimeout(c, 1000);
    }, function(c, x) {
      assert.equal(x, 123);
      ++times;
      setTimeout(c, 1000);
    }, function(c, x) {
      assert.equal(x, 123);
      ++times;
      setTimeout(c, 1000);
    }).then(function(c) {
      assert.equal(times, 3);
      c();
    }).stdend(done);
  });
  it('.then parallel break', function(done) {
    var times = 0;
    C().then(function(c) {
      setTimeout(function() {
        ++times;
        c.break();
      }, 500);
    }, function(c) {
      setTimeout(function() {
        ++times;
        c();
      }, 1000);
    }).then(function(c) {
      throw 'will not over here'
    }).stdend(done);
  });
});
