// A1.5 增强 C:/u/<slug> 短链接路径(2026-05-19)
//
// 路由:functions/u/[[slug]].js → 拦截 /u/<任意子路径>(不拦截光的 /u)
//
// Behavior:
//   1. Lowercase the slug
//   2. Serve the Vue app at /index.html (theme is ?theme= on the client)
//   3. Keep the URL as /u/<slug> (no 302)
//   4. Inject <base href="/"> so SPA assets resolve from the origin root
//
// Existence of the slug is not checked here — /api/data?u=<slug> does that.
// Vue HomeView reads the slug from the path and loads data.

export async function onRequest({ request, env, params }) {
    // params.slug 可能是字符串(/u/foo)或数组(/u/foo/bar — 但当前用单段 [[slug]])
    let slugRaw = params && params.slug;
    if (Array.isArray(slugRaw)) slugRaw = slugRaw[0];
    if (typeof slugRaw !== 'string' || !slugRaw) {
        return new Response('Not Found', { status: 404 });
    }
    // 大小写不敏感:统一转小写
    const slug = slugRaw.toLowerCase();
    // 简单格式检查(防止恶意 path)— 符合 slug 字符集
    if (!/^[a-z0-9][a-z0-9_\-]{0,31}$/.test(slug)) {
        return new Response('Not Found', { status: 404 });
    }

    // 主题选择(可选 query)
    const url = new URL(request.url);
    const indexUrl = new URL('/index.html', url.origin);
    let resp;
    try {
        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
            resp = await env.ASSETS.fetch(indexUrl.toString());
        } else {
            resp = await fetch(indexUrl.toString(), { cf: { cacheTtl: 0 } });
        }
    } catch (e) {
        return new Response('Index file fetch failed: ' + (e && e.message), { status: 500 });
    }
    if (!resp || !resp.ok) {
        return new Response('Not Found', { status: 404 });
    }

    // /u/<slug> would otherwise resolve relative Vue assets under /u/. Anchor them at /.
    let html = await resp.text();
    html = html.replace(/<head(\s[^>]*)?>/i, function (match) {
        return match + '\n    <base href="/">';
    });

    // 缓存策略:跟未登录访问 indexN.html 一致(public, max-age 短)
    const headers = new Headers();
    headers.set('Content-Type', 'text/html;charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    // 给前端一个 hint(供调试)
    headers.set('X-Public-Slug-Path', slug);
    return new Response(html, {
        status: 200,
        headers
    });
}
