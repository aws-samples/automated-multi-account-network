/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const MetadataRepository = require('../../clients/MetadataRepository');
const BaseResource = require('../BaseResource');
const CloudformationClient = require('../../clients/CloudformationClient');

const log = require('../../util/logger');
const {
  generateMemberCidr,
} = require('../../util/netmask');

class MemberMetadata extends BaseResource {
  constructor(network, repo, cf) {
    super(network);
    this.repo = repo;
    this.cf = cf;
  }

  // eslint-disable-next-line no-unused-vars
  static async instantiate(network) {
    const repo = await MetadataRepository.instantiate(network);
    const cf = await CloudformationClient.instantiate(network);
    return new MemberMetadata(network, repo, cf);
  }

  // eslint-disable-next-line no-unused-vars
  async create(props, event) {
    const networkMetadata = await this.repo.getNetworkMetadata();
    log.debug('networkMetadata:', networkMetadata);

    const regionMetadata = await this.repo.getRegionMetadata();
    log.debug('regionMetadata:', regionMetadata);

    const memberMetadata = await this.repo.getMemberMetadata();
    log.debug('memberMetadata:', memberMetadata);

    const result = {
      NetworkCidr: networkMetadata.NetworkCidr,
      RegionalCidr: regionMetadata.RegionalCidr,
      RegionalTgwId: regionMetadata.RegionalTgwId,
      MemberCidr: memberMetadata.MemberCidr,
    };

    // TODO: better handle MemberAccount calls to Metadata vs Baseline calls to Metadata
    const vpcIdParam = await this.cf.getParameter(`/net/${this.network.name}/VpcId`);
    log.debug('vpcIdParam:', memberMetadata);
    if (vpcIdParam) {
      result.VpcId = vpcIdParam.Value;
    }

    const { subnetsBitmask, subnetsNumber } = props;
    for (let i = 0; i < subnetsNumber; i += 1) {
      result[`Subnet${i}`] = generateMemberCidr(i, memberMetadata.MemberCidr, subnetsBitmask);
    }

    return result;
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async delete(props, event) {
    return {};
  }
}

module.exports = MemberMetadata;
