/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const VpcClient = require('../../clients/VpcClient');
const BaseResource = require('../BaseResource');
const log = require('../../util/logger');
const {
  buildListOfMinimalSubnets,
} = require('../../util/netmask');

const SUBNET_BITMASK = 28;
const DELIM = ',';

class AzSubnets extends BaseResource {
  constructor(network, vpcClient) {
    super(network);
    this.vpcClient = vpcClient;
  }

  // eslint-disable-next-line no-unused-vars
  static async instantiate(network) {
    const memberVpc = await VpcClient.instantiate(network);
    return new AzSubnets(network, memberVpc);
  }

  // eslint-disable-next-line no-unused-vars
  async create(props, event) {
    const { memberCidr, vpcId } = props;
    log.debug('VpcClient.createSubnets()');
    const zoneNames = await this.vpcClient.listAzs();

    log.debug('zoneNames:', zoneNames);
    const numSubnets = zoneNames.length;
    const subnetCidrs = buildListOfMinimalSubnets(memberCidr, numSubnets, SUBNET_BITMASK);

    log.debug('subnetCidrs:', subnetCidrs);
    const promises = zoneNames
      .map((az, idx) => this.vpcClient.createSubnet(vpcId, subnetCidrs[idx], az));

    const subnets = await Promise.all(promises);

    return {
      data: {
        VpcDefaultRouteTableId: await this.getDefaultVpcRouteTable(vpcId),
        SubnetIds: subnets,
      },
      physicalResourceId: subnets.join(DELIM),
    };
  }

  // eslint-disable-next-line no-unused-vars
  async delete(props, event) {
    const subnetIds = event.PhysicalResourceId.split(DELIM);
    const promises = subnetIds
      .map((id) => this.vpcClient.deleteSubnet(id));

    await Promise.all(promises);

    return {};
  }

  async getDefaultVpcRouteTable(vpcId) {
    return this.vpcClient.getDefaultVpcRouteTable(vpcId);
  }
}

module.exports = AzSubnets;
