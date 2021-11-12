const _ = require('lodash-core');
const cfn = require('./src/util/cfn-response');
const log = require('./src/util/logger');

const ResourceFactory = require('./src/resources/ResourceFactory');

async function handler(event, context) {
  log.debug(event);

  let physicalResourceId = event.PhysicalResourceId;

  try {
    const adminAccount = process.env.ADMIN_ACCOUNT;
    const primaryRegion = process.env.PRIMARY_REGION;
    const networkName = process.env.NETWORK_NAME;

    let props = event.ResourceProperties;
    // make property names it camel case so it's easier to work with
    props = _.mapKeys(props, (v, k) => _.lowerFirst(k));
    // remove empty strings from array properties
    props = _.mapValues(props, (v) => (_.isArray(v) ? _.filter(v) : v));

    const factory = new ResourceFactory(adminAccount, primaryRegion, networkName);
    const resource = await factory.getResource(event.ResourceType);
    let response = await resource.handle(props, event);
    if (_.has(response, 'physicalResourceId')) { // TODO: always use PhysicalId
      physicalResourceId = response.physicalResourceId;
      response = response.data;
    }

    return cfn.success(event, context, response, physicalResourceId);
  } catch (err) {
    log.error(err);

    if (err.code === 'ResourceNotFoundException') {
      log.error('Make sure have all the pre-reqs in place');
    }

    return cfn.fail(event, context, err.message);
  }
}

exports.handler = handler;
