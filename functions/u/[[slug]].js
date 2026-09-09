// A1.5 เพิ่มประสิทธิภาพเส้นทางลิงก์สั้น /u/<slug>
//
// รูท: functions/u/[[slug]].js → ดักจับ /u/<เส้นทางย่อยใดๆ> (ไม่ดักจับ /u เปล่าๆ)
//
// พฤติกรรม:
//   1. แปลง slug เป็นตัวพิมพ์เล็ก
//   2. ให้บริการแอป Vue ที่ /index.html (ธีมใช้ ?theme= บนฝั่งไคลเอนต์)
//   3. คง URL ไว้เป็น /u/<slug> (ไม่มี 302)
//   4. แทรก <base href="/"> เพื่อให้แอสเซท SPA โหลดจาก root ของ origin
//
// ไม่มีการตรวจสอบความมีอยู่ของ slug ที่นี่ — /api/data?u=<slug> จะเป็นผู้จัดการ
// Vue HomeView จะอ่าน slug จาก path แล้วโหลดข้อมูล

export async function onRequest({ request, env, params }) {
    // params.slug อาจเป็นสตริง (/u/foo) หรืออาร์เรย์ (/u/foo/bar — แต่ปัจจุบันใช้ส่วนเดียว [[slug]])
    let slugRaw = params && params.slug;
    if (Array.isArray(slugRaw)) slugRaw = slugRaw[0];
    if (typeof slugRaw !== 'string' || !slugRaw) {
        return new Response('Not Found', { status: 404 });
    }
    // Case-insensitive: แปลงเป็นตัวพิมพ์เล็กเสมอ
    const slug = slugRaw.toLowerCase();
    // ตรวจสอบรูปแบบง่ายๆ (ป้องกัน malicious path) — ต้องตรงตามชุดอักขระ slug
    if (!/^[a-z0-9][a-z0-9_\-]{0,31}$/.test(slug)) {
        return new Response('Not Found', { status: 404 });
    }

    // ตัวเลือกธีม (optional query)
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

    // นโยบายแคช: สอดคล้องกับการเข้าชม index.html เมื่อยังไม่ได้เข้าสู่ระบบ (public, max-age สั้น)
    const headers = new Headers();
    headers.set('Content-Type', 'text/html;charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    // ให้ hint แก่ฝั่ง frontend (สำหรับการดีบัก)
    headers.set('X-Public-Slug-Path', slug);
    return new Response(html, {
        status: 200,
        headers
    });
}
