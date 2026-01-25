module.exports = {
    apps: [{
        name: "tibou-auto-server",
        script: "server.js",
        cwd: "./server",
        watch: true,
        ignore_watch: ["node_modules", "logs", "*.log"],
        env: {
            NODE_ENV: "production",
        }
    }]
}
