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
        _req.session.save();
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

router.post("/update-email", async (_req, res) => {
    const { email } = _req.body;
    // @ts-expect-error
    const userId = _req.session.user._id;

    try {
        const result = await Users.updateEmail(userId, email);
        
        // Fetch updated user and update session
        const updatedUser = await Users.findById(userId);
        // @ts-expect-error
        _req.session.user = updatedUser;

        res.redirect("/home/user");
    } catch (err) {
        console.error(err);
        res.redirect("/home/user");
    }
});

router.post("/update-username", async (_req, res) => {
    const { username } = _req.body;
    // @ts-expect-error
    const userId = _req.session.user._id;

    try {
        const result = await Users.updateUsername(userId, username);
        
        // Fetch updated user and update session
        const updatedUser = await Users.findById(userId);
        // @ts-expect-error
        _req.session.user = updatedUser;


        res.redirect("/home/user");
    } catch (err) {
        console.error(err);
        res.redirect("/home/user");
    }
});

router.post("/update-password", async (_req, res) => {
    const { password } = _req.body;
    // @ts-expect-error
    const userId = _req.session.user._id;

    try {
        const result = await Users.updatePassword(userId, password);
        
        // Fetch updated user and update session
        const updatedUser = await Users.findById(userId);
        // @ts-expect-error
        _req.session.user = updatedUser;

        res.redirect("/home/user");
    } catch (err) {
        console.error(err);
        res.redirect("/home/user");
    }
});

router.post("/update-profile-image", async (_req, res) => {
    let selectedImage = _req.body.image;
    selectedImage = selectedImage.replace(/\.png$/, '');
    
    // @ts-expect-error
    const userId = _req.session.user._id;

    try {
        const result = await Users.updateProfileImage(userId, selectedImage);
        
        // Fetch updated user and update session
        const updatedUser = await Users.findById(userId);
        // @ts-expect-error
        _req.session.user = updatedUser;

        res.redirect("/home/user");
    } catch (err) {
        console.error(err);
        res.redirect("/home/user");
    }
});



router.post("/delete-account", async (_req, res) => {
    const { email, password } = _req.body;
    // @ts-expect-error
    const userId = _req.session.user._id;

    try {
        await Users.deleteAccount(userId, email, password);
        _req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
            }
            res.redirect("/");
        });
    } catch (err) {
        console.error(err);
        res.redirect("/home/user");
    }
});

export default router;