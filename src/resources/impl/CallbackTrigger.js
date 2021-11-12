/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const CloudformationClient = require('../../clients/CloudformationClient');
const BaseResource = require('../BaseResource');
const log = require('../../util/logger');

class CallbackTrigger extends BaseResource {
  constructor(network, cloudformationClient) {
    super(network);
    this.cloudformationClient = cloudformationClient;
  }

  // eslint-disable-next-line no-unused-vars
  static async instantiate(network) {
    const cloudformationClient = await CloudformationClient.instantiate(network);
    return new CallbackTrigger(network, cloudformationClient);
  }

  // eslint-disable-next-line no-unused-vars
  async create(props, event) {
    const { baselineParameterName } = props;

    let parameters = null;
    if (baselineParameterName) {
      log.info(`Fetching single baseline for ${baselineParameterName}`);
      parameters = await this.getBaseline(baselineParameterName);
    } else {
      log.info('Fetching all baselines');
      parameters = await this.getAllBaselines();
    }

    await this.trigger(parameters);

    return {};
  }

  async getBaseline(baselineParameterName) {
    const parameter = await this.cloudformationClient.getParameter(baselineParameterName);
    log.debug('Result from ssmClient.getParameter:');
    log.debug(parameter);

    return [parameter];
  }

  async getAllBaselines() {
    const parameters = await this.cloudformationClient.getParameters(`/net/${this.network.name}/baselines`);
    log.debug('Result from ssmClient.getParameters:');
    log.debug(parameters);

    return parameters;
  }

  // eslint-disable-next-line class-methods-use-this
  async trigger(parameters) {
    log.debug('Triggering from ssmClient.getParameters:');
    log.debug(parameters);

    const promises = parameters.map((p) => this.cloudformationClient.signalWaitCondition(p.Value));

    return await Promise.all(promises);
  }

  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async delete(props, event) {
    const { baselineParameterName } = props;

    let parameters = null;
    if (baselineParameterName) {
      log.info(`Fetching single baseline for ${baselineParameterName}`);
      parameters = await this.getBaseline(baselineParameterName);
    } else {
      log.info('Fetching all baselines');
      parameters = await this.getAllBaselines();
    }

    await this.wait(parameters);

    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  async wait(parameters) {
    log.debug('Triggering from ssmClient.getParameters:');
    log.debug(parameters);

    const promises = parameters.map((p) => this.cloudformationClient.waitStack(p.Value));

    return await Promise.all(promises);
  }
}

module.exports = CallbackTrigger;
