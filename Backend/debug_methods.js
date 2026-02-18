const fs = require('fs');
const { Client, Account } = require('node-appwrite');
const client = new Client();
const account = new Account(client);

const output = `Client: ${Object.getOwnPropertyNames(Object.getPrototypeOf(client)).join(', ')}\nAccount: ${Object.getOwnPropertyNames(Object.getPrototypeOf(account)).join(', ')}`;
fs.writeFileSync('debug_output.txt', output);
