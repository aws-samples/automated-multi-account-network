/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
const AwsClientFactory = require('./AwsClientFactory');
const log = require('../util/logger');

class VpcClient {
  constructor(network, client) {
    this.network = network;
    this.client = client;
  }

  static async instantiate(network, member) {
    const clientFactory = new AwsClientFactory(network, member);
    const client = await clientFactory.get(AWS.EC2);

    return new VpcClient(network, client);
  }

  // eslint-disable-next-line class-methods-use-this
  buildNameTagSpecification(resourceType, name = null) {
    return [{
      ResourceType: resourceType,
      Tags: [{
        Key: 'Name',
        Value: name ? `${this.network.name}-${name}` : this.network.name,
      }, {
        Key: 'net:name',
        Value: this.network.name,
      }],
    }];
  }

  async createTgwPeeringAttachment(peerAccount, peerRegion, peerTgwId, tgwId) {
    log.debug('VpcClient.createTgwPeeringAttachment');
    const params = {
      PeerAccountId: peerAccount,
      PeerRegion: peerRegion,
      PeerTransitGatewayId: peerTgwId,
      TransitGatewayId: tgwId,
      TagSpecifications: this.buildNameTagSpecification('transit-gateway-attachment'),
    };

    log.debug('Calling AWS.EC2.createTransitGatewayPeeringAttachment with params:', params);
    const data = await this.client.createTransitGatewayPeeringAttachment(params).promise();
    return data.TransitGatewayPeeringAttachment.TransitGatewayAttachmentId;
  }

  async deleteTgwPeeringAttachment(tgwPeeringAttachmentId) {
    log.debug('VpcClient.createTgwPeeringAttachment');
    const params = {
      TransitGatewayAttachmentId: tgwPeeringAttachmentId,
    };

    log.debug('Calling AWS.EC2.deleteTransitGatewayPeeringAttachment with params:', params);
    return this.client.deleteTransitGatewayPeeringAttachment(params).promise();
  }

  async deleteTgwRouteTableRoute(tgwRouteTableId, tgwPeeringAttachmentId) {
    log.debug('VpcClient.deleteTgwRouteTableRoute');

    const searchParams = {
      Filters: [{
        Name: 'attachment.transit-gateway-attachment-id',
        Values: [tgwPeeringAttachmentId],
      }],
      TransitGatewayRouteTableId: tgwRouteTableId,
    };
    log.debug('Calling AWS.EC2.searchTransitGatewayRoutes with params:', searchParams);
    const routes = await this.client.searchTransitGatewayRoutes(searchParams).promise();

    const destinationCidrBlock = routes.Routes[0].DestinationCidrBlock;

    const deleteParams = {
      DestinationCidrBlock: destinationCidrBlock,
      TransitGatewayRouteTableId: tgwRouteTableId,
    };
    log.debug('Calling AWS.EC2.deleteTransitGatewayRoute with params:', deleteParams);
    return this.client.deleteTransitGatewayRoute(deleteParams).promise();
  }

  async getTgwPeeringAttachmentState(tgwAttachmentId) {
    log.debug('VpcClient.getTgwPeeringAttachmentState');
    const params = {
      TransitGatewayAttachmentIds: [tgwAttachmentId],
    };

    log.debug('Calling AWS.EC2.describeTransitGatewayPeeringAttachments with params:', params);
    const data = await this.client.describeTransitGatewayPeeringAttachments(params).promise();
    return data.TransitGatewayPeeringAttachments[0].State;
  }

  async acceptTgwAttachmentFromAdminAccount(tgwAttachmentId) {
    log.debug('VpcClient.acceptTgwAttachmentFromAdminAccount');
    const params = {
      TransitGatewayAttachmentId: tgwAttachmentId,
    };

    log.debug('Calling AWS.EC2.acceptTransitGatewayPeeringAttachment with params:', params);
    return this.client.acceptTransitGatewayPeeringAttachment(params).promise();
  }

  async createTransitGatewayRoute(mainTgwRouteTableId, regionalCidr, tgwAttachmentId) {
    log.debug('VpcClient.createTransitGatewayRoute');
    const params = {
      DestinationCidrBlock: regionalCidr,
      TransitGatewayRouteTableId: mainTgwRouteTableId,
      TransitGatewayAttachmentId: tgwAttachmentId,
    };

    log.debug('Calling AWS.EC2.createTransitGatewayRoute with params:', params);
    return this.client.createTransitGatewayRoute(params)
      .on('retry', (response) => {
        // wait for TgwAttachment state to be valid
        const err = response.error;
        if (err && err.code === 'IncorrectState') {
          log.debug('- retrying: ', err);
          err.retryable = true; // retry this error
          err.retryDelay = 10000; // wait 10 seconds
        }
      }).promise();
  }

  async getTgwRouteTableId(tgwId) {
    log.debug('VpcClient.getTgwRouteTableId');
    const params = {
      TransitGatewayIds: [tgwId],
    };

    log.debug('Calling AWS.EC2.describeTransitGateways with params:', params);
    const data = await this.client.describeTransitGateways(params).promise();
    return data.TransitGateways[0].Options.AssociationDefaultRouteTableId;
  }

  async getDefaultVpcRouteTable(vpcId) {
    log.debug('VpcClient.getDefaultVpcRouteTable');
    const params = {
      Filters: [{
        Name: 'association.main',
        Values: ['true'],
      }, {
        Name: 'vpc-id',
        Values: [vpcId],
      }],
    };

    log.debug('Calling AWS.EC2.describeRouteTables with params:', params);
    const data = await this.client.describeRouteTables(params).promise();
    return data.RouteTables[0].RouteTableId;
  }

  async listAzs() {
    log.debug('VpcClient.listAzs()');

    log.debug('EC2.describeAvailabilityZones()');
    const data = await this.client.describeAvailabilityZones().promise();
    return data.AvailabilityZones.map((e) => e.ZoneName);
  }

  async createSubnet(vpcId, subnetCidrBlock, az) {
    log.debug('VpcClient.createSubnet()');
    const params = {
      VpcId: vpcId,
      CidrBlock: subnetCidrBlock,
      AvailabilityZone: az,
      TagSpecifications: this.buildNameTagSpecification('subnet', az),
    };

    log.debug('Calling EC2.createSubnet with params', params);
    const data = await this.client.createSubnet(params).promise();
    return data.Subnet.SubnetId;
  }

  async deleteSubnet(subnetId) {
    log.debug('VpcClient.deleteSubnets()');

    return this.client.deleteSubnet({ SubnetId: subnetId }).promise();
  }
}

module.exports = VpcClient;
