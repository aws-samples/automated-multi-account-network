/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const sinon = require('sinon');
const { verify } = require('./util/helpers');

const Network = require('../src/model/Network');
const MetadataRepository = require('../src/clients/MetadataRepository');
const InitMetadata = require('../src/resources/impl/InitMetadata');

const NETWORK_NAME = 'my-net';
const ADMIN_ACCOUNT = '123';
const PRIMARY_REGION = 'region-1';

const LOCAL_REGION = 'region-1';
const LOCAL_REGIONAL_CIDR = '10.0.0.0/9';
const SINGLE_REGIONAL_CIDR = '10.0.0.0/8';

const NETWORK_CIDR = '10.0.0.0/8';
const REGIONAL_TGW = 'tgw-a1b2c3';

const VPC_BITMASK = 16;
const NUM_ACCOUNTS = 20;

// Test case: Single region
const SINGLE_REGIONAL_BITMASK = 8;

// Test case: Multiple region
const MULTI_REGIONAL_BITMASK = 9;
const LOCAL_REGION_2 = 'region-2';
const LOCAL_REGIONAL_CIDR_2 = '10.128.0.0/9';
const SECONDARY_REGIONS = [LOCAL_REGION_2];

process.env.AWS_REGION = LOCAL_REGION;

describe('InitMetadata resource', () => {
  const sandbox = sinon.createSandbox();
  const networkMock = new Network(ADMIN_ACCOUNT, PRIMARY_REGION, NETWORK_NAME);
  const repoMock = sandbox.createStubInstance(MetadataRepository);
  const resource = new InitMetadata(
    networkMock, repoMock,
  );

  afterEach(() => {
    sandbox.reset();
  });

  it('create multiple region', async () => {
    repoMock.updateRegionalTgwId.returns({
      RegionalCidr: LOCAL_REGIONAL_CIDR, RegionalTgwId: REGIONAL_TGW,
    });

    // instanciate
    const props = {
      networkCidr: NETWORK_CIDR,
      secondaryRegions: SECONDARY_REGIONS,
      regionalTgwId: REGIONAL_TGW,
      numAccounts: NUM_ACCOUNTS,
    };
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.create(props, event);

    // assert expectations
    verify(repoMock.initMetadata).calledWith(MULTI_REGIONAL_BITMASK, VPC_BITMASK, NETWORK_CIDR);
    verify(repoMock.putRegionMetadata.firstCall).calledWith(LOCAL_REGION, LOCAL_REGIONAL_CIDR);
    verify(repoMock.putRegionMetadata.secondCall).calledWith(LOCAL_REGION_2, LOCAL_REGIONAL_CIDR_2);
    verify(repoMock.updateRegionalTgwId).calledWith(LOCAL_REGION, REGIONAL_TGW);
    verify(actualResult).match({});
  });

  it('create single region', async () => {
    repoMock.updateRegionalTgwId.returns({ RegionalCidr: '10.0.0.0/9', RegionalTgwId: REGIONAL_TGW });

    // instanciate

    const props = {
      networkCidr: NETWORK_CIDR,
      secondaryRegions: [],
      regionalTgwId: REGIONAL_TGW,
      numAccounts: NUM_ACCOUNTS,
    };
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.create(props, event);

    // assert expectations
    verify(repoMock.initMetadata).calledWith(SINGLE_REGIONAL_BITMASK, VPC_BITMASK, NETWORK_CIDR);
    verify(repoMock.putRegionMetadata).calledWith(LOCAL_REGION, SINGLE_REGIONAL_CIDR);
    verify(repoMock.updateRegionalTgwId).calledWith(LOCAL_REGION, REGIONAL_TGW);
    verify(actualResult).match({});
  });
});
