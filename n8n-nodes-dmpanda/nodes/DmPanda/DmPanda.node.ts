import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class DmPanda implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DM Panda',
		name: 'dmPanda',
		icon: 'file:dmPanda.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with DM Panda Instagram DM & Comment Automations API',
		defaults: {
			name: 'DM Panda',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'dmPandaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Analytics', value: 'analytics' },
					{ name: 'Automation', value: 'automation' },
					{ name: 'Execution Log', value: 'executionLog' },
				],
				default: 'automation',
			},

			// ------------------------------------------------------------------
			// Resource: Account
			// ------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'List all connected Instagram accounts',
						action: 'Get connected instagram accounts',
					},
				],
				default: 'getMany',
			},

			// ------------------------------------------------------------------
			// Resource: Analytics
			// ------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['analytics'],
					},
				},
				options: [
					{
						name: 'Get Overview',
						value: 'get',
						description: 'Get performance overview and DM send metrics',
						action: 'Get analytics metrics',
					},
				],
				default: 'get',
			},

			// ------------------------------------------------------------------
			// Resource: Automation
			// ------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['automation'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new DM automation flow',
						action: 'Create an automation',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete an existing automation',
						action: 'Delete an automation',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get details of a specific automation by ID',
						action: 'Get an automation',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'List user automations',
						action: 'List automations',
					},
					{
						name: 'Toggle Status',
						value: 'toggle',
						description: 'Activate or pause an automation',
						action: 'Toggle automation status',
					},
					{
						name: 'Trigger DM',
						value: 'trigger',
						description: 'Trigger DM payload to an Instagram user',
						action: 'Trigger DM message to recipient',
					},
				],
				default: 'getMany',
			},

			// Fields for Automation: Get / Delete / Toggle / Trigger
			{
				displayName: 'Automation ID',
				name: 'automationId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['get', 'delete', 'toggle', 'trigger'],
					},
				},
				description: 'Unique ID of the automation',
			},

			// Fields for Automation: Toggle
			{
				displayName: 'Active',
				name: 'isActive',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['toggle'],
					},
				},
				description: 'Whether the automation should be active (true) or paused (false)',
			},

			// Fields for Automation: Trigger
			{
				displayName: 'Recipient Username / ID',
				name: 'recipient',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['trigger'],
					},
				},
				description: 'Instagram username or ID of the recipient',
			},
			{
				displayName: 'Custom Message Override',
				name: 'customMessage',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['trigger'],
					},
				},
				description: 'Optional message override to send instead of default automation reply text',
			},

			// Fields for Automation: Create
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['create'],
					},
				},
				description: 'Name of the automation flow',
			},
			{
				displayName: 'Trigger Type',
				name: 'triggerType',
				type: 'options',
				options: [
					{ name: 'Post/Reel Comment', value: 'post_comment' },
					{ name: 'Story Reply', value: 'story_reply' },
					{ name: 'Direct Message', value: 'dm_message' },
					{ name: 'Live Comment', value: 'live_comment' },
				],
				default: 'post_comment',
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Keywords (Comma-Separated)',
				name: 'keywords',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['create'],
					},
				},
				description: 'Keywords to trigger this flow (e.g., "PRICE, INFO, LINK")',
			},
			{
				displayName: 'Reply Text',
				name: 'replyText',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['automation'],
						operation: ['create'],
					},
				},
				description: 'Text message sent to the Instagram user when triggered',
			},

			// ------------------------------------------------------------------
			// Resource: Execution Log
			// ------------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['executionLog'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'List execution history logs',
						action: 'List execution logs',
					},
				],
				default: 'getMany',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				displayOptions: {
					show: {
						resource: ['executionLog'],
						operation: ['getMany'],
					},
				},
				description: 'Max number of log records to return',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('dmPandaApi');

		const apiKey = credentials.apiKey as string;
		const rawBaseUrl = (credentials.baseUrl as string) || 'https://api.dmpanda.com/api/v1';
		const baseUrl = rawBaseUrl.replace(/\/+$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				let responseData: any;

				const options: any = {
					headers: {
						'X-API-Key': apiKey,
						'Content-Type': 'application/json',
					},
					json: true,
				};

				if (resource === 'account') {
					if (operation === 'getMany') {
						options.method = 'GET';
						options.uri = `${baseUrl}/accounts`;
						responseData = await this.helpers.request(options);
					}
				} else if (resource === 'analytics') {
					if (operation === 'get') {
						options.method = 'GET';
						options.uri = `${baseUrl}/analytics`;
						responseData = await this.helpers.request(options);
					}
				} else if (resource === 'automation') {
					if (operation === 'getMany') {
						options.method = 'GET';
						options.uri = `${baseUrl}/automations`;
						responseData = await this.helpers.request(options);
					} else if (operation === 'get') {
						const automationId = this.getNodeParameter('automationId', i) as string;
						options.method = 'GET';
						options.uri = `${baseUrl}/automations/${automationId}`;
						responseData = await this.helpers.request(options);
					} else if (operation === 'create') {
						const title = this.getNodeParameter('title', i) as string;
						const triggerType = this.getNodeParameter('triggerType', i) as string;
						const rawKeywords = this.getNodeParameter('keywords', i) as string;
						const replyText = this.getNodeParameter('replyText', i) as string;

						const keywords = rawKeywords ? rawKeywords.split(',').map(k => k.trim()) : [];

						options.method = 'POST';
						options.uri = `${baseUrl}/automations`;
						options.body = {
							title,
							triggerType,
							keywords,
							replyText,
						};
						responseData = await this.helpers.request(options);
					} else if (operation === 'toggle') {
						const automationId = this.getNodeParameter('automationId', i) as string;
						const isActive = this.getNodeParameter('isActive', i) as boolean;
						options.method = 'PATCH';
						options.uri = `${baseUrl}/automations/${automationId}`;
						options.body = { isActive };
						responseData = await this.helpers.request(options);
					} else if (operation === 'delete') {
						const automationId = this.getNodeParameter('automationId', i) as string;
						options.method = 'DELETE';
						options.uri = `${baseUrl}/automations/${automationId}`;
						responseData = await this.helpers.request(options);
					} else if (operation === 'trigger') {
						const automationId = this.getNodeParameter('automationId', i) as string;
						const recipient = this.getNodeParameter('recipient', i) as string;
						const customMessage = this.getNodeParameter('customMessage', i) as string;
						options.method = 'POST';
						options.uri = `${baseUrl}/automations/${automationId}/trigger`;
						options.body = {
							recipientUsername: recipient,
							customMessage,
						};
						responseData = await this.helpers.request(options);
					}
				} else if (resource === 'executionLog') {
					if (operation === 'getMany') {
						const limit = this.getNodeParameter('limit', i) as number;
						options.method = 'GET';
						options.uri = `${baseUrl}/logs?limit=${limit}`;
						responseData = await this.helpers.request(options);
					}
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData?.data || responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);

			} catch (error: any) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: error.message } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
