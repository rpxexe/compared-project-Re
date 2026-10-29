const crypto = require('crypto');
const env = require('../config/env');

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

function hashOtp(phone, otp) {
  return crypto.createHmac('sha256', env.secret()).update(`${phone}:${otp}`).digest('hex');
}

function otpMatches(record, phone, otp) {
  if (!record || !/^\d{6}$/.test(String(otp))) return false;
  const a = Buffer.from(record.codeHash, 'hex');
  const b = Buffer.from(hashOtp(phone, String(otp)), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generateOtp, hashOtp, otpMatches };
