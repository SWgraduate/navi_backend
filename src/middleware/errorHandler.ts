import { ErrorRequestHandler } from "express";
import multer from "multer";
import { ValidateError } from "tsoa";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidateError) {
    res.status(422).json({
      message: "Validation failed",
      details: err?.fields ?? {},
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        message: "File is too large",
      });
      return;
    }

    res.status(400).json({
      message: "File upload error",
      details: err.message,
    });
    return;
  }

  // status 속성이 있는 에러 (AuthenticationError 등 HTTP 상태코드를 명시한 에러)
  if (err instanceof Error && typeof (err as any).status === "number") {
    res.status((err as any).status).json({
      message: err.message,
    });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    message: "Unknown server error",
  });
};