const { createApp } = require('./src/app.js');
const app = createApp();
const request = require('supertest');

request(app)
  .get('/api/v1/unknown-route')
  .then(res => {
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.body, null, 2));
  })
  .catch(err => {
    console.error('Error:', err);
  });