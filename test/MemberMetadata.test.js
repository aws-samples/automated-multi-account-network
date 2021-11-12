/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const sinon = require('sinon');
const { verify } = require('./util/helpers');

const Network = require('../src/model/Network');
const CloudformationClient = require('../src/clients/CloudformationClient');
const MetadataRepository = require('../src/clients/MetadataRepository');
const MemberMetadata = require('../src/resources/impl/MemberMetadata');

const NETWORK_NAME = 'my-net';
const ADMIN_ACCOUNT = '123';
const PRIMARY_REGION = 'region-1';

const CURRENT_REGION = 'region-2';
const NETWORK_CIDR = '10.0.0.0/8';
const REGIONAL_CIDR = '10.0.0.0/9';
const REGIONAL_TGW_ID = 'tgw-1a2b3c';
const MEMBER_CIDR = '10.0.0.0/16';
const SUBNET0_CIDR = '10.0.0.0/24';
const SUBNET1_CIDR = '10.0.1.0/24';
const SUBNET2_CIDR = '10.0.2.0/24';
const SUBNET3_CIDR = '10.0.3.0/24';

process.env.AWS_REGION = CURRENT_REGION;

const PARAMETER_NAME = `/net/${NETWORK_NAME}/VpcId`;
const PARAMETER_VALUE = 'vpc-a1b2c3';

describe('MemberMetadata resource', () => {
  const sandbox = sinon.createSandbox();
  const networkMock = new Network(ADMIN_ACCOUNT, PRIMARY_REGION, NETWORK_NAME);
  const repoMock = sandbox.createStubInstance(MetadataRepository);
  const ssmClientStub = sandbox.createStubInstance(CloudformationClient);
  const resource = new MemberMetadata(
    networkMock, repoMock, ssmClientStub,
  );

  afterEach(() => {
    sandbox.reset();
  });

  it('create', async () => {
    repoMock.getNetworkMetadata.returns({ NetworkCidr: NETWORK_CIDR, MemberBitmask: 'foo' });
    repoMock.getRegionMetadata.returns({
      RegionalCidr: REGIONAL_CIDR, RegionalTgwId: REGIONAL_TGW_ID,
    });
    repoMock.getMemberMetadata.returns({ MemberCidr: MEMBER_CIDR, AssignmentId: 'foo' });

    ssmClientStub.getParameter.returns({
      Name: PARAMETER_NAME,
      Value: PARAMETER_VALUE,
    });

    // instanciate
    const props = {};
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.create(props, event);

    // assert expectations
    verify(repoMock.getNetworkMetadata).calledWithExactly();
    verify(repoMock.getRegionMetadata).calledWithExactly();
    verify(repoMock.getMemberMetadata).calledWithExactly();

    verify(ssmClientStub.getParameter).calledWith(PARAMETER_NAME);

    const expectedResult = {
      MemberCidr: MEMBER_CIDR,
      RegionalCidr: REGIONAL_CIDR,
      RegionalTgwId: REGIONAL_TGW_ID,
      NetworkCidr: NETWORK_CIDR,
      VpcId: PARAMETER_VALUE,
    };

    verify(actualResult).match(expectedResult);
  });

  it('create with CIDR generation', async () => {
    repoMock.getNetworkMetadata.returns({ NetworkCidr: NETWORK_CIDR, MemberBitmask: 'foo' });
    repoMock.getRegionMetadata.returns({
      RegionalCidr: REGIONAL_CIDR, RegionalTgwId: REGIONAL_TGW_ID,
    });
    repoMock.getMemberMetadata.returns({ MemberCidr: MEMBER_CIDR, AssignmentId: 'foo' });

    // instanciate
    const props = {
      subnetsBitmask: 24,
      subnetsNumber: 4,
    };
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.create(props, event);

    // assert expectations
    verify(repoMock.getNetworkMetadata).calledWithExactly();
    verify(repoMock.getRegionMetadata).calledWithExactly();
    verify(repoMock.getMemberMetadata).calledWithExactly();

    const expectedResult = {
      MemberCidr: MEMBER_CIDR,
      RegionalCidr: REGIONAL_CIDR,
      RegionalTgwId: REGIONAL_TGW_ID,
      NetworkCidr: NETWORK_CIDR,
      Subnet0: SUBNET0_CIDR,
      Subnet1: SUBNET1_CIDR,
      Subnet2: SUBNET2_CIDR,
      Subnet3: SUBNET3_CIDR,
    };

    verify(actualResult).match(expectedResult);
  });
});
