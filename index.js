"use strict";

class MyPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider("aws");

    this.commands = {
      "get-stack": {
        lifecycleEvents: ["run"],
      },
    };

    this.hooks = {
      "get-stack:run": this.findGraphQlApiStack.bind(this),
    };
  }

  async getStackName() {
    const response = await this.provider.request(
      "CloudFormation",
      "describeStacks",
      { StackName: "daikin-dealer-services-api-dev" }
    );
    console.log("Response: ", response);
  }

  async findGraphQlApiStack() {
    const stackName = this.provider.naming.getStackName();

    try {
      const stackContainingGraphQlApi = await this.getStackContainingGraphQlApi(
        stackName
      );
      if (stackContainingGraphQlApi) {
        this.serverless.cli.log(
          `Stack containing GraphQlApi: ${stackContainingGraphQlApi}`
        );
      } else {
        this.serverless.cli.log(
          "No GraphQlApi resource found in nested stacks."
        );
      }
    } catch (error) {
      this.serverless.cli.log(`Error fetching stacks: ${error.message}`);
    }
  }

  async getStackContainingGraphQlApi(stackName) {
    console.log("StackName: ", stackName);
    let stackContainingGraphQlApi = null;

    const describeStacks = async (stackName) => {
      try {
        const response = await this.provider.request(
          "CloudFormation",
          "describeStacks",
          { StackName: stackName }
        );

        if (response.Stacks) {
          for (const stack of response.Stacks) {
            const found = await listNestedStackResources(stack.StackName);
            if (found) {
              stackContainingGraphQlApi = stack.StackName;
              break;
            }
          }
        }
      } catch (error) {
        this.serverless.cli.log(
          `Error describing stack ${stackName}: ${error.message}`
        );
      }
      return false;
    };

    const listNestedStackResources = async (stackName) => {
      try {
        const response = await this.provider.request(
          "CloudFormation",
          "listStackResources",
          { StackName: stackName }
        );

        if (response.StackResourceSummaries) {
          for (const resource of response.StackResourceSummaries) {
            if (resource.ResourceType === "AWS::AppSync::GraphQLApi") {
              return true;
            }
            if (resource.ResourceType === "AWS::CloudFormation::Stack") {
              await describeStacks(resource.PhysicalResourceId);
            }
          }
        }
      } catch (error) {
        this.serverless.cli.log(
          `Error listing resources for stack ${stackName}: ${error.message}`
        );
      }
      return false;
    };

    await describeStacks(stackName);

    return stackContainingGraphQlApi;
  }
}

module.exports = MyPlugin;

