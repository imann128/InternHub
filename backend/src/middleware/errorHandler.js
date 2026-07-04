// Errors that already carry an explicit status < 500 were deliberately
// thrown as operational/validation errors (e.g. multer's file-type/size
// rejections in fileUpload.js/upload.js) and their message is meant to
// reach the client. Anything else — unhandled exceptions, raw Postgres
// errors, connection failures — defaults to 500 and, in production, gets a
// generic message instead of leaking internals (constraint names, column
// names, stack-adjacent details) to the response body. The full error is
// always logged server-side regardless.
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Multer's own errors (file too large, too many files, etc.) don't carry
  // a .status — they're always safe, user-facing validation messages
  // though, same as the fileFilter errors above which do set .status.
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  const isOperational = status < 500;
  const showDetail = isOperational || process.env.NODE_ENV !== 'production';

  res.status(status).json({
    success: false,
    message: showDetail ? (err.message || 'Internal Server Error') : 'Internal Server Error',
  });
};

module.exports = errorHandler;
