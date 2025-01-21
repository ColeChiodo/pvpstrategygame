import express from "express";
import authenticationMiddleware from "../middleware/authentication";

const router = express.Router();

router.get("/", (_req, res) => {
    res.render("landing");
});

router.get("/home", authenticationMiddleware, (req, res) => {
    // @ts-expect-error
    const user = req.session.user;
    res.render("home", { user: user, showUser: false });
});

router.get("/home/user", authenticationMiddleware, (req, res) => {
    // @ts-expect-error
    const user = req.session.user;
    res.render("home", { user: user, showUser: true });
});

router.get("/play", authenticationMiddleware, (req, res) => {
    // @ts-expect-error
    const user = req.session.user;
    res.render("game", { user: user, isPrivate: false });
});

router.get("/play/private", authenticationMiddleware, (req, res) => {
    // @ts-expect-error
    const user = req.session.user;
    res.render("game", { user: user, isPrivate: true });
});

router.get("/register", (_req, res) => {
    res.render("registration");
});

router.get("/login", (_req, res) => {
    res.render("login");
});

router.get("/terms", (_req, res) => {
    res.render("terms");
});

router.get("/about", (_req, res) => {
    res.render("about");
});

export default router;