const { Client } = require('node-appwrite');
const client = new Client();
console.log('Methods of Client:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
console.log('setSession exists:', typeof client.setSession);
console.log('addHeader exists:', typeof client.addHeader);
