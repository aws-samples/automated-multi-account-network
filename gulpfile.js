/* eslint-disable import/order */
const fs = require('fs');
const _ = require('lodash-core');

const gulp = require('gulp');
const { series, parallel } = require('gulp');
const template = require('gulp-template');
const install = require('gulp-install');
const zip = require('gulp-zip');
const tap = require('gulp-tap');

const log = require('./src/util/logger');

// Initialize

const { env } = process;
const configFile = env.CONFIG_FILE || 'tasks/variables.json';
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
_.merge(env, config.env);
config.build.version = config.build.versionAlias || env.npm_package_version;

// AWS SDK has it's own initialization, load it after we set things up

const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const organizations = new AWS.Organizations();
const cloudformation = new AWS.CloudFormation();

// Tasks

async function info() {
  log.info('env:');
  log.info(env);
  log.info('');
  log.info('config:');
  log.info(config);
  return await Promise.resolve();
}

async function clean() {
  fs.rmdirSync('build', { recursive: true });
  return await Promise.resolve();
}

async function createBuckets() {
  const json = fs.readFileSync(`tasks/${config.createBuckets.policyTemplate}`, 'utf8');
  const compilied = _.template(json);

  const orgResponse = await organizations.describeOrganization({}).promise();
  const orgId = orgResponse.Organization.Id;

  const promises = config.build.regions.map(async (region) => {
    const createParams = {
      Bucket: `${config.build.bucketPrefix}${region}`,
    };
    if (region !== 'us-east-1') {
      createParams.CreateBucketConfiguration = {
        LocationConstraint: region,
      };
    }

    const bucketPolicy = compilied({
      config, env, orgId, region,
    });
    const bucketPolicyParams = {
      Bucket: `${config.build.bucketPrefix}${region}`,
      Policy: bucketPolicy,
    };

    try {
      await s3.createBucket(createParams).promise();
      await s3.putBucketPolicy(bucketPolicyParams).promise();
      log.info(`Bucket ${bucketPolicyParams.Bucket} created successfully`);
    } catch (e) {
      log.warn(`Error creating ${bucketPolicyParams.Bucket}. Skipping`);
      log.debug(e);
    }
  });

  return await Promise.all(promises);
}

function buildTemplates() {
  const opts = {
    interpolate: /<%=([\s\S]+?)%>/g,
  };

  return gulp.src('./templates/**/*.yaml')
    .pipe(template({ config, env }, opts))
    .pipe(gulp.dest(`./build/dist/${config.build.pathPrefix}/${config.build.version}`));
}

function buildLambdaCode() {
  return gulp.src(['./src/**', './package.json', './app.js', '!./node_modules'], { base: '.' })
    .pipe(gulp.dest('./build/lambda'))
    .pipe(install({ production: true }));
}

function packageLambdaCode() {
  return gulp.src(['./build/lambda/**'])
    .pipe(zip('archive.zip'))
    .pipe(gulp.dest(`./build/dist/${config.build.pathPrefix}/${config.build.version}`));
}

function dist() {
  return gulp.src(['./build/dist/**'])
    .pipe(zip(`${env.npm_package_name}-${config.build.version}.zip`))
    .pipe(gulp.dest('./build'));
}

async function upload(region, file) {
  if (file.isDirectory()) return;
  const params = {
    ACL: 'bucket-owner-full-control',
    Body: file.contents,
    Bucket: `${config.build.bucketPrefix}${region}`,
    Key: `${file.relative}`,
  };
  await s3.putObject(params).promise();

  log.info(`${config.build.bucketPrefix}${region}/${file.relative} uploaded`);
}

async function publish() {
  const promises = config.build.regions.map((region) => gulp.src(['./build/dist/**']).pipe(tap((file) => upload(region, file))));

  return await Promise.all(promises);
}

function generateName() {
  const timestamp = new Date().getTime().toString();
  return `net-${timestamp}`;
}

async function deploy() {
  const stackName = config.deploy.stackName || generateName();
  const parameters = _.transform(config.deploy.paramOverrides, (result, value, key) => {
    result.push({
      ParameterKey: key,
      ParameterValue: value,
    });
  }, []);

  const params = {
    StackName: stackName,
    Capabilities: [
      'CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND',
    ],
    Parameters: parameters,
    TemplateURL: `https://${config.build.bucketPrefix}${AWS.config.region}.s3.amazonaws.com/${config.build.pathPrefix}/${config.build.version}/topologies/net-local-admin.yaml`,
  };

  const response = await cloudformation.createStack(params).promise();
  log.info(`Stack created: ${response.StackId}`);
  return await Promise.resolve();
}

exports.info = info;
exports.clean = clean;
exports.createBuckets = createBuckets;
exports.build = parallel(
  buildTemplates,
  series(buildLambdaCode, packageLambdaCode),
);
exports.dist = dist;
exports.all = series(
  exports.clean,
  exports.build,
  exports.dist,
);
exports.publish = publish;
exports.deploy = deploy;
