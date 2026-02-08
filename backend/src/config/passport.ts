import passport from "passport";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth20";
import {
  Strategy as DiscordStrategy,
  Profile as DiscordProfile,
} from "passport-discord";
import prisma from "./database";

passport.serializeUser((user: any, done: any) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { rank: true, loadout: true },
    });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "",
    },
    async (_accessToken, _refreshToken, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email provided"), undefined);
        }

        let user = await prisma.user.findUnique({
          where: { email },
          include: { rank: true, loadout: true },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              provider: "google",
              providerId: profile.id,
              email,
              username: profile.displayName || email.split("@")[0],
              displayName: profile.displayName || email.split("@")[0],
              avatar: "/assets/avatars/free/default.png",
              level: 1,
              xp: 0,
              rank: {
                create: {
                  elo: 1000,
                  tier: "BRONZE",
                  season: 1,
                },
              },
              loadout: {
                create: {
                  unitSkins: {},
                  reaction: "default",
                },
              },
            },
            include: { rank: true, loadout: true },
          });
        } else if (user.provider !== "google") {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { provider: "google", providerId: profile.id },
            include: { rank: true, loadout: true },
          });
        }

        done(null, user);
      } catch (err) {
        done(err, undefined);
      }
    },
  ),
);

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      callbackURL: process.env.DISCORD_CALLBACK_URL || "",
      scope: ["identify", "email"],
    },
    async (_accessToken, _refreshToken, profile: DiscordProfile, done: any) => {
      try {
        const email = profile.email;
        if (!email) {
          return done(new Error("No email provided"), undefined);
        }

        const discriminator = profile.discriminator;
        const username =
          discriminator === "0"
            ? profile.username
            : `${profile.username}#${discriminator}`;

        let user = await prisma.user.findUnique({
          where: { email },
          include: { rank: true, loadout: true },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              provider: "discord",
              providerId: profile.id,
              email,
              username,
              displayName: username,
              avatar: "/assets/avatars/free/default.png",
              level: 1,
              xp: 0,
              rank: {
                create: {
                  elo: 1000,
                  tier: "BRONZE",
                  season: 1,
                },
              },
              loadout: {
                create: {
                  unitSkins: {},
                  reaction: "default",
                },
              },
            },
            include: { rank: true, loadout: true },
          });
        } else if (user.provider !== "discord") {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { provider: "discord", providerId: profile.id },
            include: { rank: true, loadout: true },
          });
        }

        done(null, user);
      } catch (err) {
        done(err, undefined);
      }
    },
  ),
);

export default passport;
