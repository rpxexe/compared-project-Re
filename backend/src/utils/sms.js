const env = require('../config/env');
const { AppError } = require('./errors');

// Overridable in tests.
let sender = null;
const setSmsSender = (fn) => { sender = fn; };

async function twilioSend(to, body) {
  const { sid, token, from } = env.twilio;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!res.ok) throw new AppError(502, 'Could not send the OTP SMS. Please try again.');
}

async function sendSms(phone10, body) {
  const to = `+91${phone10}`;
  if (sender) return sender(to, body);
  return twilioSend(to, body);
}

module.exports = { sendSms, setSmsSender };
