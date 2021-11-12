/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const MetadataRepository = require('../../clients/MetadataRepository');
const VpcClient = require('../../clients/VpcClient');
const BaseResource = require('../BaseResource');
const log = require('../../util/logger');

async function wait(check) {
  const result = await check();
  log.debug(result);
  return new Promise((resolve) => {
    if (!result) {
      setTimeout(() => resolve(wait(check)), 5000);
    } else {
      resolve(result);
    }
  });
}

class SecondaryRegionRegistration extends BaseResource {
  constructor(network, repo, primaryMemberVpc, memberVpc) {
    super(network);
    this.repo = repo;
    this.primaryMemberVpc = primaryMemberVpc;
    this.memberVpc = memberVpc;
  }

  // eslint-disable-next-line no-unused-vars
  static async instantiate(network) {
    const repo = await MetadataRepository.instantiate(network);
    const primaryMemberVpc = await VpcClient.instantiate(network, network.primaryAdminMember);
    const memberVpc = await VpcClient.instantiate(network);

    return new SecondaryRegionRegistration(network, repo, primaryMemberVpc, memberVpc);
  }

  // eslint-disable-next-line no-unused-vars
  async create(props, event) {
    const { region, regionalTgwId } = props;

    log.info('Registering Admin Region');
    const primaryRegionMetadata = await this.repo.getRegionMetadata(this.network.region);
    const regionalMetadata = await this.repo.getRegionMetadata(region);

    const mainTgwId = primaryRegionMetadata.RegionalTgwId;
    const regionalCidr = regionalMetadata.RegionalCidr;

    const mainTgwRouteTableId = await this.primaryMemberVpc.getTgwRouteTableId(mainTgwId);
    const tgwRouteTableId = await this.memberVpc.getTgwRouteTableId(regionalTgwId);

    // create Peering Attachment with AdminAccount
    const tgwPeeringAttachmentId = await this.memberVpc.createTgwPeeringAttachment(
      this.network.account, this.network.region, mainTgwId, regionalTgwId,
    );

    // store TgwId to Metadata
    await this.repo.updateRegionalTgwId(region, regionalTgwId);

    // wait until it's pending acceptance
    await wait(async () => {
      const state = await this.memberVpc.getTgwPeeringAttachmentState(tgwPeeringAttachmentId);
      log.debug(state);
      return state === 'pendingAcceptance';
    });

    // accept from the admin account
    await this.primaryMemberVpc.acceptTgwAttachmentFromAdminAccount(tgwPeeringAttachmentId);

    // wait until attachment is available
    await wait(async () => {
      const state = await this.memberVpc.getTgwPeeringAttachmentState(tgwPeeringAttachmentId);
      log.debug(state);
      return state === 'available';
    });

    // create TGW route on the Admin Account
    await this.primaryMemberVpc.createTransitGatewayRoute(
      mainTgwRouteTableId,
      regionalCidr,
      tgwPeeringAttachmentId,
    );

    return {
      data: {
        TgwRouteTableId: tgwRouteTableId,
        TgwPeeringAttachmentId: tgwPeeringAttachmentId,
      },
      physicalResourceId: tgwPeeringAttachmentId,
    };
  }

  // eslint-disable-next-line no-unused-vars
  async delete(props, event) {
    const tgwPeeringAttachmentId = event.PhysicalResourceId;
    log.info('De-registering Region');

    const primaryRegionMetadata = await this.repo.getRegionMetadata(this.network.region);
    const mainTgwId = primaryRegionMetadata.RegionalTgwId;
    const mainTgwRouteTableId = await this.primaryMemberVpc.getTgwRouteTableId(mainTgwId);

    await this.primaryMemberVpc.deleteTgwRouteTableRoute(
      mainTgwRouteTableId, tgwPeeringAttachmentId,
    );

    await this.memberVpc.deleteTgwPeeringAttachment(tgwPeeringAttachmentId);

    // wait until it's pending acceptance
    await wait(async () => {
      const state = await this.memberVpc.getTgwPeeringAttachmentState(tgwPeeringAttachmentId);
      log.debug(state);
      return state === 'deleted';
    });

    return {};
  }
}

module.exports = SecondaryRegionRegistration;
