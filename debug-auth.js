async function testAuth() {
  try {
    console.log('Testing health endpoint...');
    const health = await fetch('http://localhost:3001/health');
    console.log('Health status:', health.status, await health.text());

    console.log('Testing auth register endpoint...');
    const register = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    console.log('Register status:', register.status, await register.text());

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAuth();