"use strict";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const mode = process.env.NODE_ENV === "production" ? "production" : "development";

const config = {
    entry: {
        main: path.join(process.cwd(), "src", "client", "main.ts"),
        game: path.join(process.cwd(), "src", "client", "game.ts"),
        tailwind: path.join(process.cwd(), "src", "client", "tailwind.ts"),
        audiosliderhandler: path.join(process.cwd(), "src", "client", "audiosliderhandler.ts"),
        imageparallax: path.join(process.cwd(), "src", "client", "imageparallax.ts"),
    },
    mode,
    output: {
        path: path.join(process.cwd(), "src", "public", "js"),
        filename: "[name].js",
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.css$/, // Handle CSS files
                use: [
                    "style-loader", // Injects styles into the DOM
                    "css-loader",   // Resolves CSS imports
                    {
                        loader: "postcss-loader", // Applies PostCSS (Tailwind)
                        options: {
                            postcssOptions: {
                                plugins: [
                                    require("tailwindcss"),
                                    require("autoprefixer"),
                                ],
                            },
                        },
                    },
                ],
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
};

export default config;
