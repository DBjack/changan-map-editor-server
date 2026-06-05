module.exports = {
  apps: [
    {
      name: 'changan-map-editor',
      script: 'npm run start:prod',
      instances: 1, // 进程数
      max_memory_restart: '1G',
      watch: false, // 监控文件变化
      autorestart: true, // 自动重启
      watch: false, // 监控文件变化
      max_memory_restart: '1G', // 最大内存占用
      env: {
        NODE_ENV: 'development', // 开发环境
      },
      env_production: {
        NODE_ENV: 'production', // 生产环境
      },
      error_file: './logs/pm2-err.log', // 错误日志文件
      out_file: './logs/pm2-out.log', // 输出日志文件
      log_file: './logs/pm2-combined.log', // 组合日志文件
      time: true, // 时间戳
      log_date_format: 'YYYY-MM-DD HH:mm:ss', // 日志日期格式
    },
  ],
};
