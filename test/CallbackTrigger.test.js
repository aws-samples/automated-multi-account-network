/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const sinon = require('sinon');

const { verify } = require('./util/helpers');

const CloudformationClient = require('../src/clients/CloudformationClient');
const Network = require('../src/model/Network');
const CallbackTrigger = require('../src/resources/impl/CallbackTrigger');

const NETWORK_NAME = 'my-net';
const ADMIN_ACCOUNT = '123';
const PRIMARY_REGION = 'region-1';

const BASELINE_NAME = 'ExampleBaseline';
const PARAMETER_NAME = `/net/${NETWORK_NAME}/baselines/${BASELINE_NAME}`;
const PARAMETER_VALUE = 'https://foo.bar';
const PARAMETER_NAME2 = `/net/${NETWORK_NAME}/baselines/${BASELINE_NAME}2`;
const PARAMETER_VALUE2 = 'https://foo.bar2';

const networkMock = new Network(ADMIN_ACCOUNT, PRIMARY_REGION, NETWORK_NAME);

describe('CallbackTrigger resource', () => {
  const sandbox = sinon.createSandbox();
  const cloudformationClientStub = sandbox.createStubInstance(CloudformationClient);
  const resource = new CallbackTrigger(
    networkMock, cloudformationClientStub,
  );

  afterEach(() => {
    sandbox.reset();
  });

  it('EventBridge rule for SSM Parameter creation event', async () => {
    // stub return values
    cloudformationClientStub.getParameter.returns({
      Name: PARAMETER_NAME,
      Value: PARAMETER_VALUE,
    });

    // invoke
    const props = {
      baselineParameterName: PARAMETER_NAME,
    };
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.handle(props, event);

    // assert expectations
    verify(cloudformationClientStub.getParameter).calledWith(PARAMETER_NAME);
    verify(cloudformationClientStub.signalWaitCondition).calledOnce();

    const expectedResult = {};
    verify(actualResult).match(expectedResult);
  });

  it('CloudFormation resource creation', async () => {
    // stub return values
    cloudformationClientStub.getParameters.returns([
      {
        Name: PARAMETER_NAME,
        Value: PARAMETER_VALUE,
      },
      {
        Name: PARAMETER_NAME2,
        Value: PARAMETER_VALUE2,
      },
    ]);

    // invoke
    const props = {
    };
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.handle(props, event);

    // assert expectations
    verify(cloudformationClientStub.getParameters).calledOnce();
    verify(cloudformationClientStub.signalWaitCondition).calledTwice();

    const expectedResult = {};
    verify(actualResult).match(expectedResult);
  });
});
