/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const MetadataRepository = require('../../clients/MetadataRepository');
const BaseResource = require('../BaseResource');
const log = require('../../util/logger');
const {
  splitCidr,
  getCidrBlock,
} = require('../../util/netmask');

const MIN_VPC_BITMASK = 16;

class InitMetadata extends BaseResource {
  constructor(network, repo) {
    super(network);
    this.repo = repo;
  }

  // eslint-disable-next-line no-unused-vars
  static async instantiate(network) {
    const repo = await MetadataRepository.instantiate(network);
    return new InitMetadata(network, repo);
  }

  // eslint-disable-next-line no-unused-vars
  async create(props, event) {
    const {
      networkCidr,
      secondaryRegions,
      regionalTgwId,
      numAccounts,
    } = props;

    const allRegions = [this.network.region, ...secondaryRegions];
    const numRegions = allRegions.length;
    const {
      regionalBitmask,
      memberBitmask,
    } = this.calculateSubCidrs(networkCidr, numRegions, numAccounts);

    await this.repo.initMetadata(regionalBitmask, memberBitmask, networkCidr);

    const firstRegionalCidr = this.replaceBitmask(networkCidr, regionalBitmask);
    const promisses = allRegions.map((r, idx) => {
      const regionalCidr = getCidrBlock(firstRegionalCidr, idx);
      log.debug('regionalCidr:', regionalCidr);
      return this.repo.putRegionMetadata(r, regionalCidr);
    });

    await Promise.all(promisses);

    await this.repo.updateRegionalTgwId(this.network.region, regionalTgwId);

    return {};
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async delete(props, event) {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  replaceBitmask(cidr, newBitmask) {
    return cidr.replace(/\/[0-9]+/i, `/${newBitmask}`);
  }

  calculateSubCidrs(networkCidr, numRegions, numAccounts) {
    log.debug('Load.calculateSubCidrs()');
    const regionalBitmask = splitCidr(networkCidr, numRegions);
    log.debug('regionalBitmask:', regionalBitmask);
    const firstRegionalCidr = this.replaceBitmask(networkCidr, regionalBitmask);
    log.debug('firstRegionalCidr:', firstRegionalCidr);
    let memberBitmask = splitCidr(firstRegionalCidr, numAccounts);
    memberBitmask = Math.max(memberBitmask, MIN_VPC_BITMASK);
    log.debug('memberBitmask:', memberBitmask);
    return { regionalBitmask, memberBitmask };
  }
}

module.exports = InitMetadata;
