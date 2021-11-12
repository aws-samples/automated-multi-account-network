/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const MetadataRepository = require('../../clients/MetadataRepository');
const BaseResource = require('../BaseResource');
const log = require('../../util/logger');
const {
  generateMemberCidr,
} = require('../../util/netmask');

class MemberRegistration extends BaseResource {
  constructor(network, repo) {
    super(network);
    this.repo = repo;
  }

  // eslint-disable-next-line no-unused-vars
  static async instantiate(network) {
    const repo = await MetadataRepository.instantiate(network);
    return new MemberRegistration(network, repo);
  }

  // eslint-disable-next-line no-unused-vars
  async create(props, event) {
    const assignmentId = await this.repo.generateAssignmentId();
    log.debug('assignmentId:', assignmentId);
    const networkMetadata = await this.repo.getNetworkMetadata();
    const memberBitmask = networkMetadata.MemberBitmask;
    log.debug('networkMetadata:', networkMetadata);
    const regionMetadata = await this.repo.getRegionMetadata();
    const regionalCidr = regionMetadata.RegionalCidr;
    log.debug('regionMetadata:', regionMetadata);

    if (!regionalCidr || !memberBitmask) {
      throw new Error(`Cannnot retrieve Regional information. Make sure you provisioned Admin Account ${this.network.account}`);
    }

    const memberCidr = generateMemberCidr(assignmentId, regionalCidr, memberBitmask);
    log.debug('memberCidr:', memberCidr);

    await this.repo.putMemberMetadata(assignmentId, memberCidr);

    return {
      MemberCidr: memberCidr,
      AssignmentId: assignmentId,
      NetworkCidr: networkMetadata.NetworkCidr,
      RegionalTgwId: regionMetadata.RegionalTgwId,
    };
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async delete(props, event) {
    return {};
  }
}

module.exports = MemberRegistration;
