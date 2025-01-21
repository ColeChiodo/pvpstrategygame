import express from "express";
import authenticationMiddleware from "../middleware/authentication";

const router = express.Router();

const fs = require('fs');
const path = require('path');

router.get("/", (_req, res) => {
    res.render("landing");
});

router.get("/home", authenticationMiddleware, (req, res) => {
    // @ts-expect-error
    const user = req.session.user;
    const imageDir = path.join(__dirname, '..', '..', 'public', 'assets', 'profileimages');

    fs.readdir(imageDir, (err: any, files: any[]) => {
        if (err) {
          return res.status(500).send(`Unable to read image directory`);
        }
        
        // Filter only PNG files
        const images = files.filter((file: string) => file.endsWith('.png'));
        
        res.render('home', { user: user, images });
    });
});

router.get("/home/user", authenticationMiddleware, (req, res) => {
    // @ts-expect-error
    const user = req.session.user;
    const imageDir = path.join(__dirname, '..', '..', 'public', 'assets', 'profileimages');

    fs.readdir(imageDir, (err: any, files: any[]) => {
        if (err) {
          return res.status(500).send('Unable to read image directory');
        }
        
        // Filter only PNG files
        const images = files.filter((file: string) => file.endsWith('.png'));
        
        res.render('home', { user: user, images });
    });
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