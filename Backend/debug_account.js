const { Client, Account } = require('node-appwrite');
const client = new Client();
const account = new Account(client);
console.log('Methods of Account:', Object.getOwnPropertyNames(Object.getPrototypeOf(account)));
