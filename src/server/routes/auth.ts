import express from "express";
import { Users } from "../database";

const router = express.Router();

router.post("/register", (_req, res) => {
    const { username, email, password, confirmPassword } = _req.body;

    try {
        const user = Users.register(email, username, password);
        // @ts-expect-error 
        _req.session.user = user;
        
        res.redirect("/login");
    } catch(err) {
        console.error(err);
        res.redirect("/register");
    }
});

router.post("/login", async (_req, res) => {
    const { credential, password } = _req.body;

    try {
        const user = await Users.login(credential, password);
        // @ts-expect-error
        _req.session.user = user;
        res.redirect("/home");
    } catch(err) {
        console.error(err);
        res.redirect("/login");
    }
});

router.get("/logout", (request, response) => {
    request.session.destroy((err) => {
        console.log(err);
        response.redirect("/");
    });
});

export default router;