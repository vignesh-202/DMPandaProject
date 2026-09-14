module.exports = {
  apps: [
    {
      name: 'dm-panda-gateway',
      script: './server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'dm-panda-backend',
      script: './Backend/app.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'dm-panda-streamer',
      script: './streamer-node/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    },
    {
      name: 'dm-panda-worker',
      script: './worker-node/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      }
    },
    {
      name: 'dm-panda-frontend',
      script: './serve-frontend.js',
      env: {
        NODE_ENV: 'production',
        FRONTEND_PORT: 5173
      }
    },
    {
      name: 'dm-panda-admin',
      script: './serve-admin.js',
      env: {
        NODE_ENV: 'production',
        ADMIN_PORT: 5174
      }
    }
  ]
};
