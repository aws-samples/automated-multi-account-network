// eslint-disable-next-line import/no-extraneous-dependencies
const sinon = require('sinon');

/**
 * Semantic util function for assertion. Instead of:
 *
 *  sandbox.assert.calledOnce(cloudformationClientStub.signalWaitCondition);
 *
 * It allows us to write:
 *
 *  verify(cloudformationClientStub.signalWaitCondition).calledOnce()
 *
 * @param {*} stub
 * @returns
 */
exports.verify = function verify(stub) {
  return new Proxy({}, {
    get(target, assertion) {
      return (...args) => sinon.assert[assertion](stub, ...args);
    },
  });
};
