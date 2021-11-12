/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const InitMetadata = require('./impl/InitMetadata');
const SecondaryRegionRegistration = require('./impl/SecondaryRegionRegistration');
const AzSubnets = require('./impl/AzSubnets');
const MemberRegistration = require('./impl/MemberRegistration');
const Network = require('../model/Network');
const MemberMetadata = require('./impl/MemberMetadata');
const CallbackTrigger = require('./impl/CallbackTrigger');

const RESOURCES = {
  'Custom::AzSubnets': AzSubnets,
  'Custom::MemberMetadata': MemberMetadata,
  'Custom::MemberRegistration': MemberRegistration,
  'Custom::SecondaryRegionRegistration': SecondaryRegionRegistration,
  'Custom::InitMetadata': InitMetadata,
  'Custom::CallbackTrigger': CallbackTrigger,
};

module.exports = class ResourceFactory {
  constructor(adminAccount, primaryRegion, networkName) {
    this.adminAccount = adminAccount;
    this.primaryRegion = primaryRegion;
    this.networkName = networkName;
  }

  async getResource(resourceType) {
    const Resource = RESOURCES[resourceType];
    if (!Resource) {
      throw new Error('Unkown ResourceType');
    }

    const network = new Network(this.adminAccount, this.primaryRegion, this.networkName);
    return Resource.instantiate(network);
  }
};
