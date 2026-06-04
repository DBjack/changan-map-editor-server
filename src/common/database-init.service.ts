import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private readonly configService: ConfigService) {}

  // 在模块初始化时调用，确保数据库已创建
  async onModuleInit() {
    await this.initializeDatabase();
  }

  // 初始化数据库，创建必要的数据库和表(typeorm无法自动创建数据库和表，需要在模块初始化前创建数据库)
  private async initializeDatabase() {
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<number>('DB_PORT', 3306);
    const username = this.configService.get<string>('DB_USERNAME', 'root');
    const password = this.configService.get<string>(
      'DB_PASSWORD',
      'Root@123456',
    );
    const database = this.configService.get<string>('DB_DATABASE', 'layer');

    try {
      // 先连接到 MySQL 服务器（不指定数据库）
      const connection = await mysql.createConnection({
        host,
        port,
        user: username,
        password,
      });

      // 创建数据库（如果不存在）
      await connection.execute(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );

      this.logger.log(`✅ 数据库 '${database}' 已准备就绪`);
      await connection.end();
    } catch (error) {
      this.logger.error(`❌ 数据库初始化失败: ${error.message}`);
      throw error;
    }
  }
}
