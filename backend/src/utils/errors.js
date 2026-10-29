class AppError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const bad = (m, extra) => new AppError(400, m, extra);
module.exports = { AppError, bad };
