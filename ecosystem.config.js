module.exports = {
  apps: [
    {
      name: "gestion-deposito-backend",
      cwd: "./backend",
      script: "python",
      args: "-m uvicorn app.main:app --host 0.0.0.0 --port 8000",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        PYTHONUNBUFFERED: "1"
      }
    },
    {
      name: "gestion-deposito-frontend",
      cwd: "./frontend",
      script: "npx",
      args: "serve -s dist -l 5173",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M"
    }
  ]
};

