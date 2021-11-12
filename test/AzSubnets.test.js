/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const sinon = require('sinon');
const { verify } = require('./util/helpers');

const AzSubnets = require('../src/resources/impl/AzSubnets');
const Network = require('../src/model/Network');
const VpcClient = require('../src/clients/VpcClient');

const NETWORK_NAME = 'my-net';
const ADMIN_ACCOUNT = '123';
const PRIMARY_REGION = 'region-1';

const AZ_1A = 'region-1a';
const AZ_1B = 'region-1b';
const AZ_1C = 'region-1c';
const SUBNET_1A = 'subnet-1a1a1a';
const SUBNET_1B = 'subnet-1b1b1b';
const SUBNET_1C = 'subnet-1c1c1c';
const SUBNETS = [SUBNET_1A, SUBNET_1B, SUBNET_1C];
const ROUTE_TABLE = 'rtb-a1b2c3';
const VPC = 'vpc-a1b2c3';

describe('AzSubnets resource', () => {
  const sandbox = sinon.createSandbox();
  const networkMock = new Network(ADMIN_ACCOUNT, PRIMARY_REGION, NETWORK_NAME);
  const memberNetworkMock = sandbox.createStubInstance(VpcClient);
  const resource = new AzSubnets(
    networkMock, memberNetworkMock,
  );

  afterEach(() => {
    sandbox.reset();
  });

  it('create', async () => {
    memberNetworkMock.listAzs.returns([AZ_1A, AZ_1B, AZ_1C]);

    memberNetworkMock.createSubnet.onFirstCall().returns(SUBNET_1A);
    memberNetworkMock.createSubnet.onSecondCall().returns(SUBNET_1B);
    memberNetworkMock.createSubnet.onThirdCall().returns(SUBNET_1C);

    memberNetworkMock.getDefaultVpcRouteTable.returns(ROUTE_TABLE);

    // instanciate
    const props = {
      vpcId: VPC,
      memberCidr: '10.0.0.0/8',
    };
    const event = {
      RequestType: 'Create',
    };
    const actualResult = await resource.create(props, event);

    // assert expectations
    verify(memberNetworkMock.listAzs).called();
    verify(memberNetworkMock.createSubnet).calledWith(VPC, '10.0.0.0/28', AZ_1A);
    verify(memberNetworkMock.createSubnet).calledWith(VPC, '10.0.0.16/28', AZ_1B);
    verify(memberNetworkMock.createSubnet).calledWith(VPC, '10.0.0.32/28', AZ_1C);
    verify(memberNetworkMock.getDefaultVpcRouteTable).calledWith(VPC);

    const expectedResult = {
      data: {
        VpcDefaultRouteTableId: ROUTE_TABLE,
        SubnetIds: SUBNETS,
      },
      physicalResourceId: SUBNETS.join(','),
    };

    verify(actualResult).match(expectedResult);
  });

  it('delete', async () => {
    memberNetworkMock.listAzs.returns([AZ_1A, AZ_1B, AZ_1C]);

    // instanciate
    const props = {
      vpcId: VPC,
      memberCidr: '10.0.0.0/8',
    };
    const event = {
      RequestType: 'Delete',
      PhysicalResourceId: SUBNETS.join(','),
    };
    const actualResult = await resource.delete(props, event);

    // assert expectations
    verify(memberNetworkMock.deleteSubnet.firstCall).calledWith(SUBNET_1A);
    verify(memberNetworkMock.deleteSubnet.secondCall).calledWith(SUBNET_1B);
    verify(memberNetworkMock.deleteSubnet.thirdCall).calledWith(SUBNET_1C);
    verify(actualResult).match({});
  });
});
