module.exports = {
  apps: [{
    name: "restobook-api",
    script: "./index.js",
    exec_mode: "fork",
    instances: 1,
    max_memory_restart: "300M",
    node_args: "--max-old-space-size=256"
  }]
}
