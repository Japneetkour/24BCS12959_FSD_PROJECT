const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const config = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.set('trust proxy', 1); // correct client IPs behind Render/Heroku/NGINX for rate limiting

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // avatars may be loaded from the client origin
  })
);
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / server-to-server requests (no Origin header) and configured origins.
      if (!origin || config.corsOrigins.includes(origin.toLowerCase())) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . operators from user input (NoSQL injection)
if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

// Avatars are public images. Resource files are NOT served statically — only via the protected download route.
app.use(
  '/uploads/avatars',
  express.static(path.join(config.uploadDir, 'avatars'), { maxAge: '7d', index: false, dotfiles: 'deny' })
);

app.use('/api', apiLimiter, routes);

// Optional single-service deployment: serve the built React app from Express.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (config.serveClient && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api|uploads|socket\.io).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
