/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
const AwsClientFactory = require('./AwsClientFactory');
const log = require('../util/logger');

const META = 'META';

class MetadataRepository {
  constructor(network, member, client) {
    this.network = network;
    this.member = member;
    this.client = client;

    this.tableName = `Network-${network.name}`;
  }

  static async instantiate(network) {
    const clientFactory = new AwsClientFactory(network, network.primaryAdminMember);
    const member = await clientFactory.getCurrentMember();
    const client = await clientFactory.get(AWS.DynamoDB.DocumentClient);

    return new MetadataRepository(network, member, client);
  }

  async getRegionMetadata(region = null) {
    log.info('Fetching regional metadata (getRegionMetadata)');

    const params = {
      TableName: this.tableName,
      Key: {
        Account: META,
        Region: region || this.member.region,
      },
    };

    log.debug('Calling DynamoDB.DocumentClient.get with params:', params);
    const data = await this.client.get(params).promise();

    log.debug('- returned:', data);
    return data.Item;
  }

  async putRegionMetadata(region, regionalCidr) {
    log.info('Storing regional metadata (putRegionMetadata)');
    const params = {
      TableName: this.tableName,
      Item: {
        Account: META,
        Region: region,
        RegionalCidr: regionalCidr,
        RegionalTgwId: '',
        Assignments: 0,
      },
    };

    log.debug('Calling DynamoDB.DocumentClient.put with params:', params);
    return this.client.put(params).promise();
  }

  async updateRegionalTgwId(region, regionalTgwId) {
    log.info('Update reginal TransitGateway Id (updateRegionalTgwId)');
    const params = {
      TableName: this.tableName,
      Key: {
        Account: META,
        Region: region,
      },
      UpdateExpression: 'set RegionalTgwId = :val',
      ExpressionAttributeValues: {
        ':val': regionalTgwId,
      },
    };

    log.debug('Calling DynamoDB.DocumentClient.update with params:', params);
    return this.client.update(params).promise();
  }

  async getMemberMetadata(account = null, region = null) {
    log.info('Fetching account metadata (getMemberMetadata)');

    const params = {
      TableName: this.tableName,
      Key: {
        Account: account || this.member.account,
        Region: region || this.member.region,
      },
    };

    log.debug('Calling DynamoDB.DocumentClient.get with params:', params);
    const data = await this.client.get(params).promise();

    log.debug('- returned:', data);
    return data.Item;
  }

  async putMemberMetadata(assignmentId, memberCidr, account = null, region = null) {
    log.info('Storing account metadata (putMemberMetadata)');

    const params = {
      TableName: this.tableName,
      Item: {
        Account: account || this.member.account,
        Region: region || this.member.region,
        AssignmentId: assignmentId,
        MemberCidr: memberCidr,
      },
    };

    log.debug('Calling DynamoDB.DocumentClient.put with params:', params);
    return this.client.put(params).promise();
  }

  async getNetworkMetadata() {
    log.info('Fetching network metadata (getNetworkMetadata)');

    const params = {
      TableName: this.tableName,
      Key: {
        Account: META,
        Region: META,
      },
    };

    log.debug('Calling DynamoDB.DocumentClient.get with params:', params);
    const data = await this.client.get(params).promise();

    log.debug('- returned:', data);
    return data.Item;
  }

  async initMetadata(regionalBitmask, memberBitmask, networkCidr) {
    log.info('Initializing VpcClient metadata (initMetadata)');
    const params = {
      TableName: this.tableName,
      Item: {
        Account: META,
        Region: META,
        RegionalBitmask: regionalBitmask,
        MemberBitmask: memberBitmask,
        NetworkCidr: networkCidr,
      },
    };

    log.debug('Calling DynamoDB.DocumentClient.put with params:', params);
    return this.client.put(params).promise();
  }

  async generateAssignmentId() {
    log.info('Generating assigningId (generateAssignmentId)');

    const params = {
      TableName: this.tableName,
      Key: {
        Account: META,
        Region: this.member.region,
      },
      UpdateExpression: 'set Assignments = Assignments + :val',
      // ConditionExpression: {
      // }
      ExpressionAttributeValues: {
        ':val': 1,
      },
      ReturnValues: 'UPDATED_OLD',
    };

    log.debug('Calling DynamoDB.DocumentClient.update with params:', params);
    const data = await this.client.update(params).promise();

    log.debug('- returned:', data);
    return data.Attributes.Assignments;
  }
}

module.exports = MetadataRepository;
