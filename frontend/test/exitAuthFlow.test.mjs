import test from 'node:test';
import assert from 'node:assert/strict';
import exitAuthFlow from '../src/navigation/exitAuthFlow.js';

function nav(names) {
  const calls = [];
  return {
    calls,
    getState: () => ({ routes: names.map((name) => ({ name })), index: names.length - 1 }),
    pop: (n) => calls.push(['pop', n]),
    reset: (s) => calls.push(['reset', s.routes[0].name]),
  };
}

test('first launch (Welcome -> Login) goes to the tabs instead of back to onboarding', () => {
  const n = nav(['Welcome', 'Login']);
  exitAuthFlow(n);
  assert.deepEqual(n.calls, [['reset', 'Tabs']]);
});

test('Login as the initial route goes to the tabs', () => {
  const n = nav(['Login']);
  exitAuthFlow(n);
  assert.deepEqual(n.calls, [['reset', 'Tabs']]);
});

test('sign-in opened from inside the app returns to that screen', () => {
  const n = nav(['Tabs', 'PropertyDetails', 'Login']);
  exitAuthFlow(n);
  assert.deepEqual(n.calls, [['pop', 1]]);
});

test('after OTP (Login -> AuthWelcome) both auth screens are popped', () => {
  const n = nav(['Tabs', 'PropertyDetails', 'Login', 'AuthWelcome']);
  exitAuthFlow(n);
  assert.deepEqual(n.calls, [['pop', 2]]);
});

test('after OTP on first launch (Welcome -> Login -> Otp) goes to the tabs', () => {
  const n = nav(['Welcome', 'Login', 'Otp']);
  exitAuthFlow(n);
  assert.deepEqual(n.calls, [['reset', 'Tabs']]);
});

test('after OTP from inside the app (Login -> Otp) returns to where sign-in started', () => {
  const n = nav(['Tabs', 'PropertyDetails', 'Login', 'Otp']);
  exitAuthFlow(n);
  assert.deepEqual(n.calls, [['pop', 2]]);
});
