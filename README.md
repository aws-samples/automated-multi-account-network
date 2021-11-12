## Automate Networking foundation in multi-account environments 

This project provides CloudFormation templates that automate the creation and configuration of Transit Gateways, Resource Shares, VPCs, Attachments, and everything that is needed to connect VPC across accounts and regions. All you need to do is define a few parameters.

### Installing

For instructions on how to deploy and how the solution works, please see the blog post [Automate Networking foundation in multi-account environments](https://aws.amazon.com/blogs/networking-and-content-delivery/automate-networking-foundation-in-multi-account-environments/)

### FAQ

1. Can I update CloudFormation parameters (e.g. add regions, change CIDR)?

No. There's no support for updates, as this would change the way addresses get allocated and routes are defined. If you need to extend your network, you can still use secondary CIDRs and manually extend your network.

2. What happens if an account is moved out of the OU?

Nothing will change, and network won't be touched. The network uses stack sets configured to retain stack instances if accounts get moved out of the OU. If you whish to deprovision the network, you can remove stack instances explicitly through the CloudFormation console, which should deprovision the resources in an ordely fashion. Make sure you do this _before_ the account is moved out of the OU. The deletion process requires cross-account access to the Admin account, which is only granted to the target OU. If you move it first, it won't have privileges required to deprovision the account.

Please note that there's no special provision to clean up your VPC. You still need to do that, else the stack deletion may fail.

3. What if I want to have more than one Baseline template? Or specific Baseline templates for different conditions?

There's nothing special about the BaselineTemplate parameter. You can take a look at the CloudFormation template and see it creates a StackSet targeting the OU using the BaselnieTemplate parameter (see `net-local-admin.yaml` for an example). You can create additional StackSets following that pattern.

Most regular CloudFormation templates can be adapted to be used as a baseline. The main thing to be aware is networking: you may need to leverage this solution's custom resources and wait mechanism to make sure account's VPC is fully provisioned and CIDRs don't overlap (see `ec2-ssm.yaml` for an example).

### Troubleshooting

This solution creates additional Stacks, Stack Sets and Stack Instances. If you face errors with how your network is deployed, you'll need to navigate through the created resources to trobleshoot it.

**Common issues**

1. Check your SCPs
2. Check your service limits (e.g. number of VPCs and TGWs)
3. Make sure your network can accomodate all the regions and accounts. See [Automate Networking foundation in multi-account environments](https://aws.amazon.com/blogs/networking-and-content-delivery/automate-networking-foundation-in-multi-account-environments/) for details on how network is setup.

A single-region network should be at least a '/21'. This allows all the resources needed to configure the network to be created but that will leave minimum to no space to setup anything else, so you likely want a '/20' or larger network. NOTE: If you are using the example BaselineTemplate, you'll need a '/19' network or larger (see the **Default baseline template: invalid CIDR** section below for details).

_Explanation_: Assuming a maximum 8 AZs per region, a '/28' subnet per AZ, the VPC will have to be at least a '/25' to accomodate the 8 subnets. Assuming a MaxAccount value of 16 (the default), a single-region multi-account network will have to be at least a '/21' to accomodate the 16 VPCs.

If you are setting up 1 Secondary Region, it would have to be at least a '/20'. If you have 2 or 3 Secondary Regions it would have to be at least a '/19' and so on.

**Organizational Unit could not be found**

```
OrganizationalUnit ou-xxxx-xxxxxxxx in unknown organization could not be found. (Service: AWSRAM; Status Code: 400; Error Code: UnknownResourceException; Request ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx; Proxy: null)
```

Make sure you enabled RAM integration with Organizations. If you haven't done it through RAM console, check documentation for additional steps. 

**Failed creating StackSets issues**

```
Resource handler returned message: "Account used is not a delegated administrator (Service: CloudFormation, Status Code: 400, Request ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx, Extended Request ID: null)" (RequestToken: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx, HandlerErrorCode: InvalidRequest)
```

or 

```
Resource handler returned message: "Stack set operation [xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx] was unexpectedly stopped or failed" (RequestToken: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx, HandlerErrorCode: InternalFailure)
```

Make sure you that Cloudformation integration with Organizations is enabled and your account is registered as a delegated administrator

**Failed to create MemberStackSet**

```
Properties validation failed for resource MemberStackSet with message: #: #: only 1 subschema matches out of 2 #/StackInstancesGroup/0/Regions: array items are not unique
```

Make sure you are not selecting the region you are in as a SecondaryRegion. If you want your network to be single region, leave SecondaryRegion empty.

**Default baseline template: WaitCondition error**

```
ResourceLogicalId:WaitCondition, ResourceType:AWS::CloudFormation::WaitCondition, ResourceStatusReason:Failed to receive 1 resource signal(s) within the specified duration.
```

That means the VPC for that account wasn't successfully created. Check MemberStackSet for additional information

**Default baseline template: cannot connect to EC2 using Session Manager**

If you are getting an error saying Session Manager is not configured and you can't connect to the instance, make sure you allowed enough time for the instance to fully boot up. It may take a few minutes

**Default baseline template: instance type is not supported**

```
Your requested instance type (t2.micro) is not supported in your requested Availability Zone (xx-xxxxx-xx). Please retry your request by not specifying an Availability Zone or choosing ... 
```

This means the instance used in the baseline example (t2.micro) is not available in the region and/or AZ. Either change the template to use a different instance type or select different regions.

**Default baseline template: invalid CIDR**

```
ResourceLogicalId:rPrivateSubnet, ResourceType:AWS::EC2::Subnet, ResourceStatusReason:The CIDR 'x.x.x.x/24' is invalid.
```

This means your multi-account network is too small to accomodate your resources. The example template creates a '/24' subnet in the VPC, so you'd need at least a '/23' VPC. That will allow all the resources needed for setting up the network plus the '/24' subnet this example template creates (see **Common issues** section above for more details).

In order to have a '/23' VPC, you'd need a '/19' single-region network to acommodate the default MaxAccount of 16 VPCs.

## Build project

```
$ npm install
$ cp tasks/variables.json.example tasks/variables.json
$ edit tasks/variables.json
$ npm run create-buckets
$ npm run all
```

When editing `variables.json` you'll define which regions you want the artifacts available in. This solution can only be deployed to the regions where those artifacts are available. You can use AWS CLI to get a list of all regions:

```
$ aws ec2 describe-regions --query 'Regions[].RegionName' --output text
```

Optionally install `cfn-lint` for development.

### Configuring variables:

The following are variables are available (take a look at `variables.json.example` for a full example):

| Attribute                    | Description                                                                                                                                                                       | Default        |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------|
| env.*                        | **Optional**. Properties defined here will be set as environment variables. Useful to override AWS configurations.                                                                | {}             | 
| build.versionAlias           | **Optional**. Alias to be used instead of the version defined in package.json                                                                                                     |                |
| build.bucketPrefix           | **Required**. Bucket where artifacts will be published to and deployed from. The region will be appended to this prefix                                                           |                |
| build.pathPrefix             | **Optional**. Prefix to prepended to the artifact key                                                                                                                             |                |
| build.regions                | **Optional**. List of regions you want to publish to (npm run build) or deploy from (npm run deploy)                                                                              | []             |
| createBuckets.policyTemplate | Required. When running npm run createBuckets, this indicated the Bucket Policy that should be used                                                                                |                |
| deploy.stackName             | **Optional**. This specifies the name you want to give the Cloudformation stack                                                                                                   | Auto-generated |
| deploy.paramOverrides.*      | **Optional**. Properties defined here will be passed as parameter overrides when launching the template. Note that template itself may require overrides (i.e. have no default values) | {}             |

# License Summary

This sample code is made available under the MIT-0 license. See the LICENSE file.
