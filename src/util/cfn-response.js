/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const https = require('https');
const log = require('./logger');

const SUCCESS = 'SUCCESS';
const FAILED = 'FAILED';

function send(event, context, responseStatus, data, physicalResourceId, noEcho = false) {
  const json = {
    Status: responseStatus,
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: noEcho,
  };

  if (responseStatus === SUCCESS) {
    json.Data = data;
  } else if (responseStatus === FAILED) {
    json.Reason = `${data}. See the details in CloudWatch Logs: ${context.logGroupName}/${context.logStreamName}`;
  } else {
    throw new Error(`CloudFormation response should be either SUCCESS or FAILED. Got ${responseStatus}`);
  }

  const responseBody = JSON.stringify(json);
  log.debug('Sending request body:\n', responseBody);

  const parsedUrl = new URL(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length,
    },
  };
  log.debug('Sending options:\n', options);

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      const { statusCode, statusMessage } = response;
      log.debug(`Status code: ${statusCode}`);
      log.debug(`Status message: ${statusMessage}`);

      let body = '';
      return response
        .on('data', (chunk) => {
          body += chunk;
        })
        .on('end', () => {
          if (statusCode < 200 || statusCode >= 300) {
            return reject(new Error({ statusCode, statusMessage, body }));
          }
          return resolve(body);
        });
    });
    // reject on request error
    request
      .on('error', (error) => {
        log.debug(`send(..) failed executing https.request(..): ${error}`);
        return reject(error);
      });
    request.write(responseBody);
    request.end();
  });
}

function success(event, context, data, physicalResourceId) {
  return send(event, context, SUCCESS, data, physicalResourceId, false);
}

function fail(event, context, message) {
  return send(event, context, FAILED, message, false);
}

exports.SUCCESS = SUCCESS;
exports.FAILED = FAILED;
exports.send = send;
exports.success = success;
exports.fail = fail;
