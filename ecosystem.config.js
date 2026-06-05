module.exports = {
  apps: [
    {
      name: 'changan-map-editor',
      script: 'npm run start:prod',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        ENABLE_SWAGGER: 'true', // 生产环境是否启用 Swagger，设为 false 可禁用
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
