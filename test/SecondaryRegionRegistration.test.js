/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const sinon = require('sinon');
const { verify } = require('./util/helpers');

const Network = require('../src/model/Network');
const VpcClient = require('../src/clients/VpcClient');
const MetadataRepository = require('../src/clients/MetadataRepository');
const SecondaryRegionRegistration = require('../src/resources/impl/SecondaryRegionRegistration');

const NETWORK_NAME = 'my-net';
const ADMIN_ACCOUNT = '123';
const PRIMARY_REGION = 'region-1';

const PRIMARY_TGW = 'tgw-d4f5g6';
const PRIMARY_TGW_ROUTE_TABLE = 'tgw-rtb-d4f5g6';

const REGION = 'region-2';
const TGW = 'tgw-a1b2c3';
const TGW_ROUTE_TABLE = 'tgw-rtb-a1b2c3';

const TGW_PEERING_ATTACHMENT = 'tgw-attachment-a1b2c3';

const REGION_CIDR = '10.128.0.0/9';

describe('SecondaryRegionRegistration resource', () => {
  const sandbox = sinon.createSandbox();
  const networkMock = new Network(ADMIN_ACCOUNT, PRIMARY_REGION, NETWORK_NAME);
  const repoMock = sandbox.createStubInstance(MetadataRepository);
  const primaryMemberMock = sandbox.createStubInstance(VpcClient);
  const memberNetworkMock = sandbox.createStubInstance(VpcClient);
  const resource = new SecondaryRegionRegistration(
    networkMock, repoMock, primaryMemberMock, memberNetworkMock,
  );

  afterEach(() => {
    sandbox.reset();
  });

  it('create', async () => {
    // stub return values
    repoMock.getRegionMetadata.onFirstCall().returns({ RegionalTgwId: PRIMARY_TGW });
    repoMock.getRegionMetadata.onSecondCall().returns({ RegionalCidr: REGION_CIDR });
    primaryMemberMock.getTgwRouteTableId.returns(PRIMARY_TGW_ROUTE_TABLE);
    memberNetworkMock.getTgwRouteTableId.returns(TGW_ROUTE_TABLE);
    memberNetworkMock.createTgwPeeringAttachment.returns(TGW_PEERING_ATTACHMENT);
    memberNetworkMock.getTgwPeeringAttachmentState.onFirstCall().returns('pendingAcceptance');
    memberNetworkMock.getTgwPeeringAttachmentState.onSecondCall().returns('available');

    // invoke
    const props = {
      region: REGION,
      regionalTgwId: TGW,
    };
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.handle(props, event);

    // assert expectations
    verify(repoMock.getRegionMetadata.firstCall).calledWith(PRIMARY_REGION);
    verify(repoMock.getRegionMetadata.secondCall).calledWith(REGION);
    verify(primaryMemberMock.getTgwRouteTableId).calledWith(PRIMARY_TGW);
    verify(memberNetworkMock.getTgwRouteTableId).calledWith(TGW);
    verify(memberNetworkMock.createTgwPeeringAttachment).calledWith(
      ADMIN_ACCOUNT, PRIMARY_REGION, PRIMARY_TGW, TGW,
    );
    verify(repoMock.updateRegionalTgwId).calledWith(REGION, TGW);
    verify(memberNetworkMock.getTgwPeeringAttachmentState).calledWith(TGW_PEERING_ATTACHMENT);
    verify(primaryMemberMock.acceptTgwAttachmentFromAdminAccount).calledWith(
      TGW_PEERING_ATTACHMENT,
    );
    verify(primaryMemberMock.createTransitGatewayRoute).calledWith(
      PRIMARY_TGW_ROUTE_TABLE, REGION_CIDR, TGW_PEERING_ATTACHMENT,
    );

    const expectedResult = {
      data: {
        TgwPeeringAttachmentId: TGW_PEERING_ATTACHMENT,
        TgwRouteTableId: TGW_ROUTE_TABLE,
      },
      physicalResourceId: TGW_PEERING_ATTACHMENT,
    };
    verify(actualResult).match(expectedResult);
  });

  it('delete', async () => {
    // stub return values
    repoMock.getRegionMetadata.returns({ RegionalTgwId: PRIMARY_TGW });
    primaryMemberMock.getTgwRouteTableId.returns(PRIMARY_TGW_ROUTE_TABLE);
    memberNetworkMock.createTgwPeeringAttachment.returns(TGW_PEERING_ATTACHMENT);
    memberNetworkMock.getTgwPeeringAttachmentState.returns('deleted');

    // invoke
    const props = {
      region: REGION,
      regionalTgwId: TGW,
    };
    const event = {
      RequestType: 'Delete',
      PhysicalResourceId: TGW_PEERING_ATTACHMENT,
    };
    const actualResult = await resource.handle(props, event);

    // assert expectations
    verify(repoMock.getRegionMetadata).calledWith(PRIMARY_REGION);
    verify(primaryMemberMock.getTgwRouteTableId).calledWith(PRIMARY_TGW);
    verify(primaryMemberMock.deleteTgwRouteTableRoute).calledWith(
      PRIMARY_TGW_ROUTE_TABLE, TGW_PEERING_ATTACHMENT,
    );
    verify(memberNetworkMock.deleteTgwPeeringAttachment).calledWith(TGW_PEERING_ATTACHMENT);
    verify(memberNetworkMock.getTgwPeeringAttachmentState).calledWith(TGW_PEERING_ATTACHMENT);
    verify(actualResult).match({});
  });
});
