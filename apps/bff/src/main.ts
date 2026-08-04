import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  dotenv.config();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  await app.register(multipart as any, {
    attachFieldsToBody: 'keyValues',
  });

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['https://web-staging-sbjp.onrender.com'];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('SaaS Business Manager API')
    .setDescription('BFF para gerenciamento de negócios e tarefas')
    .setVersion('1.0')
    .addTag('business')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  await app.listen({ port: 3001, host: '0.0.0.0' });

  console.log(`🚀 Front rodando em: http://localhost:3000/`);
  console.log(`🚀 BFF rodando em: http://localhost:3001`);
  console.log(`📑 Documentação: http://localhost:3001/docs`);
}
bootstrap();