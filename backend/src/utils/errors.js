class AppError extends Error {
  // `expose` keeps the message on a 5xx response; by default those are replaced with a generic
  // one, so only set it for messages written for users.
  constructor(status, message, extra = {}, { expose = false } = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
    this.expose = expose;
  }
}
const bad = (m, extra) => new AppError(400, m, extra);
module.exports = { AppError, bad };
