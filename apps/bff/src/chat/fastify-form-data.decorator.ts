import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export const FastifyFormData = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const stream = await req.file();

    if (stream) {
      return {
        userId: (stream.fields.user_id as any)?.value,
        message: (stream.fields.message as any)?.value,
        file: {
          buffer: await stream.toBuffer(),
          filename: stream.filename,
          mimetype: stream.mimetype,
        },
      };
    }

    const body = req.body as any;

    let file:
      | { buffer: Buffer; filename: string; mimetype: string }
      | undefined = undefined;

    if (body?.file) {
      const buffer = Buffer.isBuffer(body.file)
        ? body.file
        : body.file.data || body.file.buffer;

      file = {
        buffer,
        filename:
          body.file.filename ||
          body.file.originalname ||
          'uploaded_document.pdf',
        mimetype: body.file.mimetype || 'application/pdf',
      };
    }

    return {
      userId: body?.user_id,
      message: body?.message,
      file,
    };
  },
);