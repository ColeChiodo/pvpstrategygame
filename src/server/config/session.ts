import type { Express, RequestHandler } from "express";
import flash from "express-flash";
import session from "express-session";

let sessionMiddleware: RequestHandler | undefined = undefined;
const MongoStore = require('connect-mongo');

const sessionSecret = process.env.SESSION_SECRET || 'defaultSecretKey';

export default function (app: Express): RequestHandler {
    if(sessionMiddleware === undefined) {
        sessionMiddleware = session({
            secret: sessionSecret, // Change this to a random secret key
            resave: false,             // Don't save session if unmodified
            saveUninitialized: false, // Don't save empty sessions
            store: MongoStore.create({
              mongoUrl: process.env.DATABASE_URL, // MongoDB URI
              ttl: 14 * 24 * 60 * 60, // Session expiry time (14 days)
            }),
            cookie: {
              secure: false, // Set to true if you're using HTTPS
              maxAge: 1000 * 60 * 60 * 24, // Set cookie expiry time (e.g., 1 day)
            }
        });

        app.use(sessionMiddleware);
        app.use(flash());
    }
    
    return sessionMiddleware;
}