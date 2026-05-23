const hex = `3a 7a 22 fd 69 bd ec 4e ce 6b 34 21 be f7 f7 b0 
4f 61 b8 d2 59 3b b5 45 00 7d 98 59 9b ea f6 92 
5f e5 5f a9 af ce 6f 6d c7 d9 c7 11 51 4a b4 4d 
f7 99 64 2a fc f2 8c ce 97 31 c2 4c d7 4b 5c d1 
17 36 7b a3 17 c3 38 23 87 30 57 98 2b 60 9a 19 
28 8a 87 1b 76 1c 7a 42 1c 05 72 2b f2 1d 16 b8 
a6 3a 32 b0 e9 d4 6d 40 30 df 29 38 e6 93 b3 3c 
9f 7f 72 63 80 07 ee 14 4a 7b 8a 7a 04 bf 7c b2 
8d 41 33 e3 8a 2a 9f 67 de f7 2e 86 8b 6c d5 cb 
cd e5 b1 ae 41 25 ab 84 d8 84 5f 42 3f 4a dd a6 
3e bc 70 46 1f b6 39 71 a0 8b 9a 55 07 63 67 6d 
06 41 78 35 20 aa 24 80 45 51 0a ce fd 85 7f 19 
4a 13 07 c7 a1 2b be e1 5a b9 7b 29 f3 46 6b 54 
e0 55 0c db d7 82 d5 69 52 f5 b8 17 6e 25 50 04 
f4 92 f9 fc a6 18 68 7c 35 cb 4d 0e fe 5a f9 28 
46 1f b6 19 9b fe ad 81 9f 98 30 20 78 ae 9b 8d 
e1 07 1f 07 c2 7a 2b 23 4b 73 12 5a be fe 1c 38 
b0 fc d7 fb 7a e5 03 08 79 df 2e 6a 8c 94 40 2e 
0e 25 e9 1e 58 4f b2 b7 7b 15 28 c9 08 f2 4b bb 
3b bf 48 2b 00 48 8`.replace(/\s+/g, '');

const buf = Buffer.from(hex, 'hex');
console.log('As UTF-8 string:');
console.log(buf.toString('utf-8'));
console.log('As ASCII string:');
console.log(buf.toString('ascii'));
