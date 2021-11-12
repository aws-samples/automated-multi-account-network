/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const { Netmask } = require('netmask');
const log = require('./logger');

function buildListOfMinimalSubnets(cidr, numSubnets, bitmask) {
  log.debug('netmask.buildListOfMinimalSubnets()');
  const vpc = new Netmask(cidr);
  let it = new Netmask(vpc.base, bitmask);

  const result = [it.toString()];
  for (let i = 1; i <= numSubnets; i += 1) {
    it = it.next();
    result.push(it.toString());
  }

  return result;
}

function splitCidr(parentCidr, minSegments, newBitmask = null) {
  log.debug('netmask.splitCidr()');
  const block = new Netmask(parentCidr, newBitmask);
  const bits = Math.ceil(Math.log(minSegments) / Math.log(2));
  return block.bitmask + bits;
}

function getCidrBlock(firstCidr, index) {
  log.debug('netmask.getCidrBlock()');
  const block = new Netmask(firstCidr);
  return block.next(index).toString();
}

function generateMemberCidr(assignmentId, regionalCidr, memberBitmask) {
  log.debug('netmask.generateMemberCidr()');
  const regionalBlock = new Netmask(regionalCidr);
  const vpccBlock = new Netmask(regionalBlock.base, memberBitmask);
  return getCidrBlock(vpccBlock.toString(), assignmentId);
}
module.exports = {
  buildListOfMinimalSubnets,
  splitCidr,
  generateMemberCidr,
  getCidrBlock,
};
