/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const assert = require('assert');

const {
  splitCidr,
  getCidrBlock,
} = require('../src/util/netmask');

describe('netmask', () => {
  it('calculate a RegionalBitmask of 9 for 2 regions in a 10.0.0.0/8', () => {
    const parentCidr = '10.0.0.0/8';
    const minSegments = 2;
    const bitmask = splitCidr(parentCidr, minSegments);
    assert.strictEqual(bitmask, 9);
  });
  it('calculate a RegionalBitmask of 10 for 3 regions in a 10.0.0.0/8', () => {
    const parentCidr = '10.0.0.0/8';
    const minSegments = 3;
    const bitmask = splitCidr(parentCidr, minSegments);
    assert.strictEqual(bitmask, 10);
  });
  it('calculate a RegionalBitmask of 14 for 10 regions in a 10.192.0.0/10', () => {
    const parentCidr = '10.192.0.0/10';
    const minSegments = 10;
    const bitmask = splitCidr(parentCidr, minSegments);
    assert.strictEqual(bitmask, 14);
  });

  it('calculate a MemberBitmask of 13 for 10 accounts in a 10.128.0.0/9', () => {
    const parentCidr = '10.128.0.0/9';
    const minSegments = 10;
    const bitmask = splitCidr(parentCidr, minSegments);
    assert.strictEqual(bitmask, 13);
  });
  it('calculate a MemberBitmask of 16 for 60 account in a 10.192.0.0/10', () => {
    const parentCidr = '10.192.0.0/10';
    const minSegments = 60;
    const bitmask = splitCidr(parentCidr, minSegments);
    assert.strictEqual(bitmask, 16);
  });
  it('return 10.128.0.0/9 for 2nd block starting from 10.0.0.0/9', () => {
    const initialCidr = '10.0.0.0/9';
    let cidr;
    cidr = getCidrBlock(initialCidr, 0);
    assert.strictEqual(cidr, '10.0.0.0/9');
    cidr = getCidrBlock(initialCidr, 1);
    assert.strictEqual(cidr, '10.128.0.0/9');
  });
});
