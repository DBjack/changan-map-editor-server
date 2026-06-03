const mysql = require('mysql2/promise');

async function initDatabase() {
  let connection;
  try {
    // 连接到 MySQL 服务器（不指定数据库）
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'Root@123456',
    });

    console.log('✅ 已连接到 MySQL 服务器');

    // 创建 map 数据库（如果不存在）
    await connection.execute(
      'CREATE DATABASE IF NOT EXISTS `map` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );

    console.log('✅ 数据库 map 创建成功！');

    // 切换到 map 数据库
    await connection.changeUser({ database: 'map' });
    console.log('✅ 已切换到 map 数据库');

    await connection.end();
    console.log('✅ 数据库初始化完成！');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 请检查 MySQL 服务是否已启动');
    }
    process.exit(1);
  }
}

initDatabase();
