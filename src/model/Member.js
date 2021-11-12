/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

module.exports = class Member {
  constructor(account, region, name) {
    this.account = account;
    this.region = region;
    this.name = name;
  }
};
