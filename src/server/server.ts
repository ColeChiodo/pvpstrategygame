import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import httpErrors from "http-errors";
import morgan from "morgan";
import * as path from "path";
import * as routes from './routes';
import * as configuration from './config';
// import * as middleware from "./middleware";
import { createServer } from "http";

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(process.cwd(), "src", "public")));
app.use(cookieParser());
app.set("views", path.join(process.cwd(), "src", "server", "views"));
app.set("view engine", "ejs");

const staticPath = path.join(process.cwd(), "src", "public");
app.use(express.static(staticPath));

configuration.configureLiveReload(app, staticPath);
configuration.configureSession(app)
configuration.configureSocketIO(server, app, configuration.configureSession(app));

app.use("/", routes.home);

app.use((_request, _response, next) => {
    next(httpErrors(404));
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
