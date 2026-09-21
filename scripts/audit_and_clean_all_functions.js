const path = require('path');
const { Client, Functions } = require(path.resolve(__dirname, '../Backend/node_modules/node-appwrite'));
require(path.resolve(__dirname, '../Backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../Backend/.env') });

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const functions = new Functions(client);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDeployment(functionId, deploymentId, maxWaitSec = 180) {
    console.log(`Waiting for deployment ${deploymentId} of ${functionId} to finish building...`);
    const start = Date.now();
    while ((Date.now() - start) < maxWaitSec * 1000) {
        try {
            const dep = await functions.getDeployment(functionId, deploymentId);
            console.log(`  Deployment ${deploymentId} status: ${dep.status}`);
            if (dep.status === 'ready') {
                return dep;
            }
            if (dep.status === 'failed') {
                throw new Error(`Deployment ${deploymentId} failed to build! Log: ${dep.buildLogs || 'no logs'}`);
            }
        } catch (err) {
            console.error(`  Error polling deployment: ${err.message}`);
        }
        await sleep(4000);
    }
    throw new Error(`Timeout waiting for deployment ${deploymentId}`);
}

async function cleanFunction(functionId) {
    console.log(`\n========================================`);
    console.log(`Auditing & Cleaning function: ${functionId}`);
    console.log(`========================================`);

    try {
        const fn = await functions.get(functionId);
        const activeDeploymentId = fn.deploymentId;
        console.log(`Active deployment ID: ${activeDeploymentId}`);

        // 1. List all deployments
        let deploymentsList;
        try {
            deploymentsList = await functions.listDeployments(functionId);
        } catch (err) {
            console.error(`Error listing deployments for ${functionId}: ${err.message}`);
            deploymentsList = { deployments: [] };
        }

        const allDeployments = deploymentsList.deployments || [];
        console.log(`Total deployments found: ${allDeployments.length}`);

        for (const dep of allDeployments) {
            const depId = dep.$id;
            if (depId !== activeDeploymentId) {
                console.log(`  Deleting previous/inactive deployment: ${depId} (status: ${dep.status})`);
                try {
                    await functions.deleteDeployment(functionId, depId);
                    console.log(`    Deleted deployment ${depId}`);
                } catch (delErr) {
                    console.error(`    Failed to delete deployment ${depId}: ${delErr.message}`);
                }
            } else {
                console.log(`  Keeping active deployment: ${depId} (status: ${dep.status})`);
            }
        }

        // 2. List all executions and delete them
        let totalExecutionsDeleted = 0;
        while (true) {
            let execs;
            try {
                execs = await functions.listExecutions(functionId);
            } catch (err) {
                console.error(`Error listing executions for ${functionId}: ${err.message}`);
                break;
            }

            const executions = execs.executions || [];
            if (executions.length === 0) {
                break;
            }

            console.log(`  Deleting batch of ${executions.length} executions...`);
            for (const exec of executions) {
                try {
                    await functions.deleteExecution(functionId, exec.$id);
                    totalExecutionsDeleted++;
                } catch (err) {
                    console.error(`    Failed to delete execution ${exec.$id}: ${err.message}`);
                }
            }
        }
        console.log(`Cleaned up ${totalExecutionsDeleted} executions for ${functionId}. Executions now: 0.`);

    } catch (err) {
        console.error(`Error processing function ${functionId}: ${err.message}`);
    }
}

async function main() {
    // 1. Wait for subscription-manager latest deployment if it was recently triggered
    try {
        const smFn = await functions.get('subscription-manager');
        if (smFn.latestDeploymentId && smFn.latestDeploymentId !== smFn.deploymentId) {
            console.log(`subscription-manager has a pending deployment: ${smFn.latestDeploymentId}`);
            await waitForDeployment('subscription-manager', smFn.latestDeploymentId);
            // Verify it became active or activate it
            const smUpdated = await functions.get('subscription-manager');
            console.log(`subscription-manager active deployment is now: ${smUpdated.deploymentId}`);
        }
    } catch (err) {
        console.warn(`Could not check pending subscription-manager deployment: ${err.message}`);
    }

    // 2. List all functions from Appwrite
    let allFunctions = [];
    try {
        const res = await functions.list();
        allFunctions = res.functions || [];
        console.log(`Found ${allFunctions.length} functions on Appwrite.`);
    } catch (err) {
        console.error(`Failed to list functions: ${err.message}`);
        return;
    }

    // 3. Clean up each function
    for (const fn of allFunctions) {
        await cleanFunction(fn.$id);
    }

    console.log(`\nAll functions cleaned up successfully!`);
}

main().catch(console.error);
