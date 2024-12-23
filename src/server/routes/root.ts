import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
    res.render("landing");
});

router.get("/play", (_req, res) => {
    res.render("game");
});

export default router;