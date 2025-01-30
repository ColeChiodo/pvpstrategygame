import express from "express";
import { Users } from "../database";

const router = express.Router();

router.patch("/increment-games-played", async (_req, res) => {
    const { userID } = _req.body;

    try {
        const result = await Users.incrementGamesPlayed(userID);
        const updatedUser = await Users.findById(userID);
        // @ts-expect-error
        _req.session.user = updatedUser;
        _req.session.save();

        res.send(result);
    } catch (err) {
        console.error(err);
        res.send();
    }
});

router.patch("/increment-games-won", async (_req, res) => {
    const { userID } = _req.body;

    try {
        const result = await Users.incrementGamesWon(userID);
        const updatedUser = await Users.findById(userID);
        // @ts-expect-error
        _req.session.user = updatedUser;
        _req.session.save();

        res.send(result);
    } catch (err) {
        console.error(err);
        res.send();
    }
});

router.patch("/increment-xp", async (_req, res) => {
    const { userID, didWin } = _req.body;

    try {
        const result = await Users.incrementXP(userID, didWin);
        const updatedUser = await Users.findById(userID);
        // @ts-expect-error
        _req.session.user = updatedUser;
        _req.session.save();

        res.send(result);
    } catch (err) {
        console.error(err);
        res.send();
    }
});

export default router;