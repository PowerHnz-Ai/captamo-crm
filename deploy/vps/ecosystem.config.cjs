module.exports = {
  apps: [
    {
      name: "ultra-api",
      cwd: "/var/www/ultra-api",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3010",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3010",
      },
    },
  ],
};
