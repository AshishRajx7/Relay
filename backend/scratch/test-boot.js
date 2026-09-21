require('dotenv').config();
console.log('Starting boot test...');
try {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  console.log('AppModule loaded successfully. Creating app...');
  NestFactory.create(AppModule, { logger: ['error', 'warn', 'log', 'debug'] }).then(app => {
    console.log('App created! Listening on 3000...');
    return app.listen(3000);
  }).then(() => {
    console.log('Server is listening on 3000!');
  }).catch(err => {
    console.error('Bootstrap failed:', err);
  });
} catch (err) {
  console.error('Fatal load error:', err);
}
