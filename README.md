# Balance Game

Jackbox style game of "Would You Rather"

## How to run

The current version is hosted with Cloudflare and runs on localhost port 3000.

*Will migrate to custom domain soon*

Install Cloudflare CLI (install choco first, account required for authentication):
```choco install cloudflare```

Run command
```npm run start```

In a separate terminal, run
```cloudflared tunnel --url http://localhost:3000```

Use the generated ".trycloudflare.com" link through your browser app to access the game

Enter the 4-letter room code printed on the console to join the game