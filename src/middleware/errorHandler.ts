import { ErrorRequestHandler } from "express";
import multer from "multer";
import { ValidateError } from "tsoa";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err && err.name === "ValidateError") {
    let errorMessage = "입력값이 올바르지 않습니다.";

    const validateErr = err as any;
    if (validateErr.fields) {
      const fieldNames = Object.keys(validateErr.fields);
      // 비밀번호 정규식/길이 위반 시 사용자 친화적인 메시지 매핑
      if (fieldNames.some(f => f.toLowerCase().includes('password'))) {
        errorMessage = "비밀번호는 영문, 숫자, 특수문자를 포함하여 8자리 이상이어야 합니다.";
      } else if (fieldNames.length > 0) {
        const firstField = fieldNames[0] || '';
        const cleanField = firstField.split('.').pop() || firstField;
        errorMessage = `${cleanField} 입력값이 올바르지 않습니다.`;
      }
    }

    res.status(400).json({ error: errorMessage });
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