# Habita AI landing page deployment

The public marketing page is at `/landing` and the existing application stays at `/`. This is intentional: the search, maps, user onboarding, assistant, and other app routes remain untouched.

## Netlify (existing configuration)

1. Import `dedipya001/AI-Relocation-Assistant` into Netlify (or use the existing linked site).
2. Keep the checked-in `netlify.toml` settings: base `frontend`, build `npm run build`, publish `.next`, Node.js 22. Use Netlify's current Next.js runtime/integration.
3. Set any required environment variables in Netlify's project settings, **not** in Git. Set application API/server URLs and provider keys as appropriate; never expose private credentials through `NEXT_PUBLIC_*`.
4. Deploy `main` and visit `https://<your-netlify-domain>/landing`. Check `/`, `/search` and other app routes as well.
5. To use a custom domain, add it in Netlify's Domain management and follow its DNS verification instructions. No domain or deploy is provisioned by this commit.

This repository also has production Vercel integration work. If deploying the whole app via Vercel instead, use its existing project configuration, deploy the Next.js frontend, and verify the `/landing` route at the resulting hostname. Server APIs, databases and authentication require their own configured environments.

## Smoke checks

```bash
npm --prefix frontend ci
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Visit `/landing` and check its app/GitHub links, mobile layout, `/`, `/search`, and `/assistant`. Marketing copy describes current repository capabilities and makes no claim that production SaaS hosting is already available.
