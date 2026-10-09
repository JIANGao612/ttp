import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';

async function bootstrap() {
    // 1. 创建 NestJS 应用实例
    const app = await NestFactory.create(AppModule);

    // 2. 设置全局路由前缀（所有接口都以 /api 开头）
    // app.setGlobalPrefix('api');

    // 3. 启用 CORS（允许前端跨域请求）
    app.enableCors();

    // 4. 启动 HTTP 服务器，监听 3000 端口
    await app.listen(3000, '0.0.0.0');   // ← 加 '0.0.0.0'
    console.log('🚀 Server is running on http://0.0.0.0:3000');
}

bootstrap();