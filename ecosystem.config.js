module.exports = {
    apps: [
        {
            name: "neon-strays-be",
            script: "src/server.js",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: "5000"
            }
        }
    ]
};
