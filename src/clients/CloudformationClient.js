/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
const AwsClientFactory = require('./AwsClientFactory');
const log = require('../util/logger');

class CloudformationClient {
  constructor(network, ssmClient, cfClient) {
    this.network = network;
    this.ssmClient = ssmClient;
    this.cfClient = cfClient;
  }

  static async instantiate(network, member) {
    const clientFactory = new AwsClientFactory(network, member);
    const ssmClient = await clientFactory.get(AWS.SSM);
    const cfClient = await clientFactory.get(AWS.CloudFormation);

    return new CloudformationClient(network, ssmClient, cfClient);
  }

  async getParameter(name) {
    log.debug('CloudformationClient.getParameter');
    const params = {
      Name: name,
    };

    log.debug('Calling AWS.SSM.getParameter with params:', params);
    let result = null;
    try {
      const data = await this.ssmClient.getParameter(params).promise();
      result = data.Parameter;
    } catch (e) {
      if (e.code !== 'ParameterNotFound') throw e;
    }
    return result;
  }

  async getParameters(path) {
    log.debug('CloudformationClient.getParameters');
    const params = {
      Path: path,
    };

    log.debug('Calling AWS.SSM.getParametersByPath with params:', params);
    const data = await this.ssmClient.getParametersByPath(params).promise();
    return data.Parameters;
  }

  async signalWaitCondition(stackName, logicalResourceId = 'WaitCondition') {
    log.debug('CloudformationClient.signalWaitCondition');
    const timestamp = new Date().getTime().toString();
    const params = {
      LogicalResourceId: logicalResourceId,
      StackName: stackName,
      Status: 'SUCCESS',
      UniqueId: timestamp,
    };

    log.debug('Calling AWS.CloudFormation.signalResource with params:', params);
    return await this.cfClient.signalResource(params).promise();
  }

  async waitStack(stackName, event = 'stackDeleteComplete') {
    log.debug('CloudformationClient.waitFor');
    const params = {
      StackName: stackName,
    };

    log.debug('Calling AWS.CloudFormation.waitFor with params:', params);
    return await this.cfClient.waitFor(event, params).promise();
  }
}

module.exports = CloudformationClient;
