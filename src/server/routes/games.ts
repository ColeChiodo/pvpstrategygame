import express from "express";
import { Users } from "../database";

const router = express.Router();

router.patch("/increment-games-played", async (_req, res) => {
    const { userID } = _req.body;

    try {
        const result = await Users.incrementGamesPlayed(userID);

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

        res.send(result);
    } catch (err) {
        console.error(err);
        res.send();
    }
});

export default router;