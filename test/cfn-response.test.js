/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const https = require('https');
const sinon = require('sinon');
const { verify } = require('./util/helpers');

const {
  SUCCESS,
  FAILED,
  fail,
  success,
} = require('../src/util/cfn-response');

describe('cfn-response', () => {
  const sandbox = sinon.createSandbox();
  const event = {
    StackId: 'fake-stackid',
    RequestId: 'fake-requestid',
    LogicalResourceId: 'fake-resourceid',
    ResponseURL: 'https://cloudformation-custom-resource-response-useast2.s3.us-east-2.amazonaws.com/some-fake-path?fake-param=true',
  };
  const context = {
    logGroupName: 'fake-group',
    logStreamName: 'fake-stream',
  };
  const writeStub = sandbox.stub();
  const requestStub = sandbox.stub(https, 'request');
  requestStub.callsFake(() => ({
    on: () => null,
    write: (responseBody) => writeStub(responseBody),
    end: () => null,
  }));

  afterEach(() => {
    sandbox.resetHistory();
  });

  it('successful response', async () => {
    const data = {
      key: 'value',
    };
    success(event, context, data);

    const expectedResult = JSON.stringify({
      Status: SUCCESS,
      PhysicalResourceId: context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      NoEcho: false,
      Data: data,
    });
    verify(writeStub).calledWith(expectedResult);
  });

  it('failed response', async () => {
    const message = 'There was an error';
    fail(event, context, message);

    const expectedResult = JSON.stringify({
      Status: FAILED,
      PhysicalResourceId: context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      NoEcho: false,
      Reason: `${message}. See the details in CloudWatch Logs: ${context.logGroupName}/${context.logStreamName}`,
    });
    verify(writeStub).calledWith(expectedResult);
  });
});
