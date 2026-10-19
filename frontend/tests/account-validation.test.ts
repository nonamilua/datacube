import {test} from 'node:test';
import assert from 'node:assert/strict';
import {usernameError,passwordError,displayUsername} from '../src/account-validation.ts';

test('new usernames have a frontend 16 character cap while existing 32 character names can log in',()=> {
  assert.equal(usernameError('a'.repeat(16),true),'');
  assert.equal(usernameError('a'.repeat(17),true),'username must contain 3 to 16 characters');
  assert.equal(usernameError('a'.repeat(32),false),'');
  assert.equal(usernameError('a'.repeat(33),false),'username must contain 3 to 32 characters');
  assert.equal(usernameError('aa',false),'username must contain 3 to 32 characters');
  for (const value of ['has space','has-dash','josé']) assert.equal(usernameError(value,true),'use only letters numbers and underscores');
  assert.equal(usernameError('Mixed_Case123',true),'');
});

test('password length warnings preserve case spaces and special characters',()=> {
  assert.equal(passwordError('1234567'),'password must contain 8 to 128 characters');
  assert.equal(passwordError(' Pass!123 '),'');
  assert.equal(passwordError('a'.repeat(128)),'');
  assert.equal(passwordError('a'.repeat(129)),'password must contain 8 to 128 characters');
});

test('display truncation leaves the account identifier intact',()=> {
  const full='abcdefghijklmnopqrstuv';
  assert.equal(displayUsername(full),'abcdefghijkl…');
  assert.equal(displayUsername('abcdefghijkl'),'abcdefghijkl');
  assert.equal(displayUsername('alice'),'alice');
  assert.equal(full,'abcdefghijklmnopqrstuv');
});
