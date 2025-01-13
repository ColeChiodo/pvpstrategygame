import express from "express";
import authenticationMiddleware from "../middleware/authentication";

const router = express.Router();

router.get("/", (_req, res) => {
    res.render("landing");
});

router.get("/home", authenticationMiddleware, (_req, res) => {
    res.render("home", { user: res.locals.user });
});

router.get("/play", authenticationMiddleware, (_req, res) => {
    res.render("game", { user: res.locals.user });
});

router.get("/register", (_req, res) => {
    res.render("registration");
});

router.get("/login", (_req, res) => {
    res.render("login");
});

export default router;