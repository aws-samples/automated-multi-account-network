/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const Member = require('./Member');

module.exports = class Network {
  constructor(account, region, name) {
    this.account = account;
    this.region = region;
    this.name = name;
  }

  get primaryAdminMember() {
    return new Member(this.account, this.region, this.name);
  }

  get id() {
    return `${this.account}/${this.region}/${this.name}`;
  }

  static fromId(id) {
    const [account, region, ...name] = id.split('/');
    return new Network(account, region, name.joint('/'));
  }
};
