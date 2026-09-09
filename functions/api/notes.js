// GET    /api/notes                    → โหลด index (projects + notes metadata)
// GET    /api/notes?id=<id>            → โหลดเนื้อหาตัวเต็มของโน้ต
// GET    /api/notes?export=all         → โหลดโน้ตทั้งหมดพร้อมเนื้อหาตัวเต็มสำหรับสำรองข้อมูล
// POST   /api/notes                    → บันทึกโน้ต, สร้างโปรเจกต์, สลับลำดับ (action: save_note | save_project | reorder_notes | delete_project)
// DELETE /api/notes?id=<id>            → ลบโน้ตออกจาก KV และอัปเดต index
//
// หมายเหตุ: โน้ตทั้งหมดถูกจัดเก็บใน Cloudflare KV โดยตรงเท่านั้น (แยกขาดจาก data.js 100%)

import { requireAuth, jsonResponse, getPayload } from '../_shared/auth.js';

function nsIndexKey(ns) {
    return `${ns}:notes_index`;
}

function nsNoteKey(ns, id) {
    return `${ns}:note:${id}`;
}

async function resolveNamespace(request, env) {
    const payload = await getPayload(request, env);
    const role = (payload && payload.role) || 'user';
    const uid  = payload && (payload.uid != null ? payload.uid : payload.u);
    return role === 'admin' ? 'admin' : `user:${uid}`;
}

async function readIndex(kv, ns) {
    const raw = await kv.get(nsIndexKey(ns));
    if (!raw) {
        return { projects: [], notes: [] };
    }
    try {
        const parsed = JSON.parse(raw);
        return {
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        };
    } catch {
        return { projects: [], notes: [] };
    }
}

export async function onRequestGet({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'FAV_KV is not bound' }, 500);

    const ns = await resolveNamespace(request, env);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const isExportAll = url.searchParams.get('export') === 'all';

    // 1. ดึงเนื้อหาโน้ตรายตัว
    if (id) {
        const rawNote = await env.FAV_KV.get(nsNoteKey(ns, id));
        if (!rawNote) {
            return jsonResponse({ ok: false, error: 'Note not found' }, 404);
        }
        try {
            const note = JSON.parse(rawNote);
            return jsonResponse({ ok: true, note, namespace: ns });
        } catch {
            return jsonResponse({ ok: false, error: 'Malformed note data' }, 500);
        }
    }

    // 2. Export ข้อมูลทั้งหมด (สำหรับ Backup/Offline download)
    if (isExportAll) {
        const index = await readIndex(env.FAV_KV, ns);
        const fullNotes = [];
        for (const summary of index.notes) {
            try {
                const raw = await env.FAV_KV.get(nsNoteKey(ns, summary.id));
                if (raw) fullNotes.push(JSON.parse(raw));
                else fullNotes.push({ ...summary, content: '' });
            } catch {
                fullNotes.push({ ...summary, content: '' });
            }
        }
        return jsonResponse({
            ok: true,
            projects: index.projects,
            notes: fullNotes,
            namespace: ns,
            exportedAt: new Date().toISOString()
        });
    }

    // 3. ดึงเฉพาะ Index (Projects + Notes summaries) - รวดเร็ว ประหยัด Bandwidth
    const index = await readIndex(env.FAV_KV, ns);
    return jsonResponse({
        ok: true,
        index,
        namespace: ns
    });
}

export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'FAV_KV is not bound' }, 500);

    const ns = await resolveNamespace(request, env);
    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ ok: false, error: 'Invalid JSON payload' }, 400);
    }

    const { action = 'save_note' } = body;
    const now = new Date().toISOString();

    // ───── ACTION: บันทึกหรืออัปเดตโน้ต ─────
    if (action === 'save_note') {
        const { note } = body;
        if (!note || typeof note !== 'object') {
            return jsonResponse({ ok: false, error: 'Missing note payload' }, 400);
        }

        const noteId = note.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const index = await readIndex(env.FAV_KV, ns);

        const existingSummaryIdx = index.notes.findIndex(n => n.id === noteId);
        const createdAt = existingSummaryIdx >= 0 ? index.notes[existingSummaryIdx].createdAt : (note.createdAt || now);

        // สกัดข้อความสั้น (plain text snippet) สำหรับแสดงในการ์ด
        let snippet = note.snippet;
        if (!snippet && typeof note.content === 'string') {
            snippet = note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
        }

        const fullNote = {
            id: noteId,
            title: (note.title || 'Untitled Note').trim(),
            content: note.content || '',
            snippet: snippet || '',
            coverUrl: note.coverUrl || '',
            projectId: note.projectId || null,
            pinned: Boolean(note.pinned),
            order: typeof note.order === 'number' ? note.order : (existingSummaryIdx >= 0 ? index.notes[existingSummaryIdx].order : index.notes.length),
            wordCount: typeof note.wordCount === 'number' ? note.wordCount : 0,
            charCount: typeof note.charCount === 'number' ? note.charCount : 0,
            createdAt,
            updatedAt: now
        };

        const summary = {
            id: fullNote.id,
            title: fullNote.title,
            snippet: fullNote.snippet,
            coverUrl: fullNote.coverUrl,
            projectId: fullNote.projectId,
            pinned: fullNote.pinned,
            order: fullNote.order,
            wordCount: fullNote.wordCount,
            charCount: fullNote.charCount,
            createdAt: fullNote.createdAt,
            updatedAt: fullNote.updatedAt
        };

        if (existingSummaryIdx >= 0) {
            index.notes[existingSummaryIdx] = summary;
        } else {
            index.notes.unshift(summary);
        }

        // เขียนทั้งตัวเต็มและ index
        await Promise.all([
            env.FAV_KV.put(nsNoteKey(ns, noteId), JSON.stringify(fullNote)),
            env.FAV_KV.put(nsIndexKey(ns), JSON.stringify(index))
        ]);

        return jsonResponse({ ok: true, note: fullNote, index });
    }

    // ───── ACTION: สร้างหรือแก้ไข Project Folder ─────
    if (action === 'save_project') {
        const { project } = body;
        if (!project || typeof project !== 'object') {
            return jsonResponse({ ok: false, error: 'Missing project payload' }, 400);
        }

        const projectId = project.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const index = await readIndex(env.FAV_KV, ns);

        const existingIdx = index.projects.findIndex(p => p.id === projectId);
        const createdAt = existingIdx >= 0 ? index.projects[existingIdx].createdAt : (project.createdAt || now);

        const projectItem = {
            id: projectId,
            title: (project.title || 'Untitled Project').trim(),
            description: project.description || '',
            coverUrl: project.coverUrl || '',
            color: project.color || 'blue',
            order: typeof project.order === 'number' ? project.order : (existingIdx >= 0 ? index.projects[existingIdx].order : index.projects.length),
            createdAt,
            updatedAt: now
        };

        if (existingIdx >= 0) {
            index.projects[existingIdx] = projectItem;
        } else {
            index.projects.push(projectItem);
        }

        await env.FAV_KV.put(nsIndexKey(ns), JSON.stringify(index));
        return jsonResponse({ ok: true, project: projectItem, index });
    }

    // ───── ACTION: สลับลำดับโน้ตภายในโปรเจกต์ ─────
    if (action === 'reorder_notes') {
        const { orderedIds } = body;
        if (!Array.isArray(orderedIds)) {
            return jsonResponse({ ok: false, error: 'orderedIds must be an array' }, 400);
        }

        const index = await readIndex(env.FAV_KV, ns);
        const idToOrder = new Map();
        orderedIds.forEach((id, idx) => idToOrder.set(id, idx));

        index.notes.forEach(note => {
            if (idToOrder.has(note.id)) {
                note.order = idToOrder.get(note.id);
            }
        });

        await env.FAV_KV.put(nsIndexKey(ns), JSON.stringify(index));
        return jsonResponse({ ok: true, index });
    }

    // ───── ACTION: ลบโปรเจกต์ ─────
    if (action === 'delete_project') {
        const { projectId, deleteNotes = false } = body;
        if (!projectId) {
            return jsonResponse({ ok: false, error: 'Missing projectId' }, 400);
        }

        const index = await readIndex(env.FAV_KV, ns);
        index.projects = index.projects.filter(p => p.id !== projectId);

        if (deleteNotes) {
            // ลบโน้ตทั้งหมดที่อยู่ในโปรเจกต์นี้ออกจาก KV
            const notesToDelete = index.notes.filter(n => n.projectId === projectId);
            await Promise.all(notesToDelete.map(n => env.FAV_KV.delete(nsNoteKey(ns, n.id))));
            index.notes = index.notes.filter(n => n.projectId !== projectId);
        } else {
            // ปลดโน้ตให้กลายเป็น Standalone (ไม่มีโฟลเดอร์)
            index.notes.forEach(n => {
                if (n.projectId === projectId) {
                    n.projectId = null;
                }
            });
        }

        await env.FAV_KV.put(nsIndexKey(ns), JSON.stringify(index));
        return jsonResponse({ ok: true, index });
    }

    return jsonResponse({ ok: false, error: `Unknown action: ${action}` }, 400);
}

export async function onRequestDelete({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'FAV_KV is not bound' }, 500);

    const ns = await resolveNamespace(request, env);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
        return jsonResponse({ ok: false, error: 'Missing note id' }, 400);
    }

    const index = await readIndex(env.FAV_KV, ns);
    index.notes = index.notes.filter(n => n.id !== id);

    await Promise.all([
        env.FAV_KV.delete(nsNoteKey(ns, id)),
        env.FAV_KV.put(nsIndexKey(ns), JSON.stringify(index))
    ]);

    return jsonResponse({ ok: true, id, index });
}
