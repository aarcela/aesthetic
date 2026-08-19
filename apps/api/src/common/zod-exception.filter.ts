import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

type ZodIssueLike = { message?: string };

function isZodError(
  error: unknown,
): error is { name: string; issues: ZodIssueLike[] } {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { name?: string }).name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

@Catch()
export class ZodExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (isZodError(exception)) {
      const response = host.switchToHttp().getResponse<{
        status: (code: number) => { json: (body: unknown) => void };
      }>();
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: exception.issues[0]?.message ?? 'Datos inválidos',
      });
      return;
    }

    super.catch(exception, host);
  }
}
