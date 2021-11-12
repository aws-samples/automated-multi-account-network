/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

class BaseResource {
  constructor(network) {
    this.network = network;
  }

  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  async create(_props, _event) {
    throw new Error('DELETE is not supported');
  }

  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  async delete(_props, _event) {
    throw new Error('DELETE is not supported');
  }

  async handle(props, event) {
    switch (event.RequestType) {
      case 'Create': {
        return this.create(props, event);
      }
      case 'Delete': {
        return this.delete(props, event);
      }
      default: {
        throw new Error('This resource only supports Create/Delete. If you are trying to Update, delete this resource and re-create it');
      }
    }
  }
}

module.exports = BaseResource;
