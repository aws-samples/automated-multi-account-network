/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
const Member = require('../model/Member');
const log = require('../util/logger');

const STS = new AWS.STS();

const ROLE_SUFIX = 'NetworkRole';

module.exports = class AwsClientFactory {
  constructor(network, targetMember = null) {
    this.network = network;
    this.targetMember = targetMember;
  }

  async get(clazz) {
    log.debug('Entering getClient: ', clazz);

    let options = {};
    if (this.targetMember) {
      const { account, region } = this.targetMember;

      const currentRegion = await this.getCurrentRegion();
      log.debug('Evaluated currentRegion:', currentRegion);
      if (region && region !== currentRegion) {
        log.debug('Different than targetRegion:', region);
        options.region = region;
      }

      const currentAccount = await this.getCurrentAccount();
      log.debug('Evaluated currentAccount:', currentAccount);
      if (account && account !== currentAccount) {
        log.debug('Different than targetAccount:', account);
        const keys = await this.getSessionKeys(account);
        options = { ...keys, ...options };
      }
    }

    log.debug('Initializing client with options:', options);
    // eslint-disable-next-line new-cap
    return new clazz(options);
  }

  async getSessionKeys(account) {
    const params = {
      RoleArn: `arn:aws:iam::${account}:role/${this.network.name}-${ROLE_SUFIX}`,
      RoleSessionName: 'net-custom-resource',
    };

    log.debug('Calling STS.assumeRole', params);
    const data = await STS.assumeRole(params).promise();

    log.debug('- returned:', data);
    return {
      accessKeyId: data.Credentials.AccessKeyId,
      secretAccessKey: data.Credentials.SecretAccessKey,
      sessionToken: data.Credentials.SessionToken,
    };
  }

  async getCurrentMember() {
    const account = await this.getCurrentAccount();
    const region = await this.getCurrentRegion();
    const { name } = this.network;
    return new Member(account, region, name);
  }

  // eslint-disable-next-line class-methods-use-this
  async getCurrentRegion() {
    return process.env.AWS_REGION; // TODO: find a better way
  }

  async getCurrentAccount() {
    if (!this.currentAccount) {
      const data = await STS.getCallerIdentity({}).promise();
      this.currentAccount = data.Account;
    }
    return this.currentAccount;
  }
};
