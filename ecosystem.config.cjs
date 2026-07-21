module.exports = {
  apps: [
    {
      name: 'report-settimanale',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3009',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3009',
      },
    },
  ],
}
