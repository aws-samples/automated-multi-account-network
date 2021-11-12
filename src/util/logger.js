/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const log = require('loglevel');

log.setLevel(process.env.LOG_LEVEL || 'info');

module.exports = log;
