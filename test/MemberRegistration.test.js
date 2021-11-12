/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const sinon = require('sinon');
const { verify } = require('./util/helpers');

const Network = require('../src/model/Network');
const MetadataRepository = require('../src/clients/MetadataRepository');
const MemberRegistration = require('../src/resources/impl/MemberRegistration');

const NETWORK_NAME = 'my-net';
const ADMIN_ACCOUNT = '123';
const PRIMARY_REGION = 'region-1';

const CURRENT_REGION = 'region-2';
const NETWORK_CIDR = '10.0.0.0/8';
const ASSIGNMENT_ID = 0;
const REGIONAL_TGW = 'tgw-a1b2c3';

process.env.AWS_REGION = CURRENT_REGION;

const MEMBER_CIDR = '10.0.0.0/16';

describe('MemberRegistration resource', () => {
  const sandbox = sinon.createSandbox();
  const networkMock = new Network(ADMIN_ACCOUNT, PRIMARY_REGION, NETWORK_NAME);
  const repoMock = sandbox.createStubInstance(MetadataRepository);
  const resource = new MemberRegistration(
    networkMock, repoMock,
  );

  afterEach(() => {
    sandbox.reset();
  });

  it('create', async () => {
    repoMock.generateAssignmentId.returns(ASSIGNMENT_ID);
    repoMock.getNetworkMetadata.returns({ MemberBitmask: 16, NetworkCidr: NETWORK_CIDR });
    repoMock.getRegionMetadata.returns({ RegionalCidr: '10.0.0.0/9', RegionalTgwId: REGIONAL_TGW });

    // instanciate
    const props = {};
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.create(props, event);

    // assert expectations
    verify(repoMock.generateAssignmentId).calledWithExactly();
    verify(repoMock.getNetworkMetadata).calledWithExactly();
    verify(repoMock.getRegionMetadata).calledWithExactly();
    verify(repoMock.putMemberMetadata).calledWith(ASSIGNMENT_ID, MEMBER_CIDR);

    const expectedResult = {
      MemberCidr: MEMBER_CIDR,
      AssignmentId: ASSIGNMENT_ID,
      NetworkCidr: NETWORK_CIDR,
      RegionalTgwId: REGIONAL_TGW,
    };

    verify(actualResult).match(expectedResult);
  });
});
