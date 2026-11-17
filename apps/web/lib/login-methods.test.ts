import {test} from 'node:test';
import assert from 'node:assert/strict';
import {methodParameters,loginErrorMessage,loginMethods} from './login-methods';
test('unconfigured methods cannot be activated by a browser submission',()=>{
 assert.deepEqual(methodParameters(null,{}),{});
 for(const id of ['microsoft','google','apple','email','invalid','__proto__','constructor']) assert.equal(methodParameters(id,{}),null);
 for(const raw of ['{}','[]','null','invalid']) assert.equal(methodParameters('google',{CAMPUS_LOGIN_METHODS:raw}),null);
});
test('only operator-approved exact hints enter the Campus authorization request',()=>{
 for(const method of loginMethods){
  const env={CAMPUS_LOGIN_METHODS:JSON.stringify({[method.id]:{enabled:true,domainHint:'id.example'}})};
  assert.deepEqual(methodParameters(method.id,env),{domain_hint:'id.example'});
 }
 for(const domainHint of ['https://evil.example','a&prompt=none','x\nfoo','',null]){
  assert.equal(methodParameters('google',{CAMPUS_LOGIN_METHODS:JSON.stringify({google:{enabled:true,domainHint}})}),null);
 }
 assert.equal(methodParameters('google',{CAMPUS_LOGIN_METHODS:'{"google":{"enabled":false,"domainHint":"id.example"}}'}),null);
});
test('errors are bounded copy, never reflected provider input',()=>{
 assert.equal(loginErrorMessage(null),null);
 for(const code of ['SessionExpired','OAuthAccountNotLinked','AccessDenied','ProviderUnavailable','Configuration']) assert.ok(loginErrorMessage(code));
 assert.ok(!loginErrorMessage('<script>secret</script>')!.includes('secret'));
});
