import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DmPandaApi implements ICredentialType {
	name = 'dmPandaApi';
	displayName = 'DM Panda API Key';
	documentationUrl = 'https://dmpanda.com/docs/api';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your DM Panda API Key (starts with dmp_live_)',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.dmpanda.com/api/v1',
			required: true,
			description: 'The base URL of your DM Panda Backend API server',
		},
	];
}
