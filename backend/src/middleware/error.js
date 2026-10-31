const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Request body too large'; }
  else if (err.name === 'CastError') { status = 400; message = 'Invalid value supplied'; }
  else if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors || {})[0]?.message || 'Validation failed'; }
  else if (err.code === 11000) { status = 409; message = 'Duplicate entry'; }
  if (status >= 500 && !err.expose) {
    if (!env.isTest) console.error(err);
    message = 'Something went wrong on our side. Please try again.';
  }
  res.status(status).json({ message, ...(err.extra || {}) });
}

module.exports = { notFound, errorHandler };
